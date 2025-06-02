const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { dbHelpers } = require('./db/init');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Analytics endpoints
app.get('/api/player/:username/stats', async (req, res) => {
  try {
    const stats = await dbHelpers.getPlayerStats(req.params.username);
    if (!stats) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(stats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/player/:username/games', async (req, res) => {
  try {
    const games = await dbHelpers.getPlayerGameHistory(req.params.username);
    res.json(games);
  } catch (error) {
    console.error('Error fetching player games:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/player/:username/questions', async (req, res) => {
  try {
    const questions = await dbHelpers.getPlayerQuestionHistory(req.params.username);
    res.json(questions);
  } catch (error) {
    console.error('Error fetching player questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leaderboard endpoint
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topN = parseInt(req.query.top) || 10;
    // Use a direct db connection for aggregation
    const db = dbHelpers.db || new sqlite3.Database(require('path').join(__dirname, 'db/data/flag_game.db'));
    db.all(
      `SELECT p.username, SUM(gp.score) as total_score
       FROM game_players gp
       JOIN players p ON gp.player_id = p.id
       GROUP BY p.username
       ORDER BY total_score DESC
       LIMIT ?`,
      [topN],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: 'Failed to fetch leaderboard' });
        } else {
          res.json(rows);
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

let countries = [];
let countriesLoaded = false;

// Load countries data
(async () => {
  try {
    const fetch = (await import('node-fetch')).default;
    const data = await fetch("https://restcountries.com/v3.1/all", {
      agent: new (await import('https')).Agent({
        rejectUnauthorized: false
      })
    }).then(res => res.json());
    countries = data.map(c => ({
      name: c.name.common,
      flag: c.flags?.png,
    })).filter(c => c.flag && c.name);
    countriesLoaded = true;
    console.log(`Loaded ${countries.length} countries`);
  } catch (error) {
    console.error("Failed to load countries:", error);
  }
})();

async function generateQuestion(countries) {
  if (!countries || countries.length === 0) {
    throw new Error("Countries data not loaded");
  }
  const correct = countries[Math.floor(Math.random() * countries.length)];
  const options = new Set([correct.name]);

  while (options.size < 4) {
    const rand = countries[Math.floor(Math.random() * countries.length)];
    options.add(rand.name);
  }

  return {
    correct,
    choices: Array.from(options).sort(() => 0.5 - Math.random()),
  };
}

io.on("connection", (socket) => {
  socket.on("create-room", async ({ roomId, username }) => {
    if (!countriesLoaded) {
      socket.emit("error", "Game data is still loading. Please try again in a moment.");
      return;
    }

    try {
      // Create new game
      const gameId = await dbHelpers.createGame(roomId);
      const game = await dbHelpers.getGame(roomId);

      // Create player for this socket
      const playerId = await dbHelpers.createPlayer(username, socket.id);
      const player = await dbHelpers.getPlayerBySocketId(socket.id);

      // Add player to game
      await dbHelpers.addPlayerToGame(game.id, player.id);

      // Generate first question
      const question = await generateQuestion(countries);
      const questionId = await dbHelpers.createQuestion(
        game.id,
        question.correct.name,
        question.correct.flag,
        question.choices
      );
      await dbHelpers.updateGameQuestion(game.id, questionId);

      // Join the room
      socket.join(roomId);

      // Send initial question to the creator
      socket.emit("new-question", question);

      // Get and send initial player list
      const gameState = await dbHelpers.getGameState(game.id);
      io.to(roomId).emit("player-list", gameState);

    } catch (error) {
      console.error("Error in create-room:", error);
      socket.emit("error", "Failed to create room. Please try again.");
    }
  });

  socket.on("join-room", async ({ roomId, username }) => {
    if (!countriesLoaded) {
      socket.emit("error", "Game data is still loading. Please try again in a moment.");
      return;
    }

    try {
      // Get or create game
      let game = await dbHelpers.getGame(roomId);
      if (!game) {
        const gameId = await dbHelpers.createGame(roomId);
        game = await dbHelpers.getGame(roomId);
      }

      // Create or get player for this socket
      let player = await dbHelpers.getPlayerBySocketId(socket.id);
      if (!player) {
        const playerId = await dbHelpers.createPlayer(username, socket.id);
        player = await dbHelpers.getPlayerBySocketId(socket.id);
      }

      // Only add player to this game's game_players if not already present
      const gamePlayer = await dbHelpers.getGamePlayer(game.id, player.id);
      if (!gamePlayer) {
        await dbHelpers.addPlayerToGame(game.id, player.id);
      }

      socket.join(roomId);

      // Always ensure a valid current question exists
      let sendQuestion = null;
      let needNewQuestion = false;
      if (!game.current_question_id) {
        needNewQuestion = true;
      } else {
        const currentQuestion = await dbHelpers.getQuestion(game.current_question_id);
        if (!currentQuestion) {
          needNewQuestion = true;
        } else {
          sendQuestion = {
            correct: {
              name: currentQuestion.correct_country,
              flag: currentQuestion.flag_url
            },
            choices: JSON.parse(currentQuestion.choices)
          };
        }
      }

      if (needNewQuestion) {
        const question = await generateQuestion(countries);
        const questionId = await dbHelpers.createQuestion(
          game.id,
          question.correct.name,
          question.correct.flag,
          question.choices
        );
        await dbHelpers.updateGameQuestion(game.id, questionId);
        sendQuestion = question;
      }

      io.to(roomId).emit("new-question", sendQuestion);

      // Get and send updated player list
      const gameState = await dbHelpers.getGameState(game.id);
      io.to(roomId).emit("player-list", gameState);

    } catch (error) {
      console.error("Error in join-room:", error);
      socket.emit("error", "Failed to join room. Please try again.");
    }
  });

  socket.on("submit-answer", async ({ roomId, answer }) => {
    try {
      const game = await dbHelpers.getGame(roomId);
      if (!game) return;

      const player = await dbHelpers.getPlayerBySocketId(socket.id);
      if (!player) return;

      const gamePlayer = await dbHelpers.getGamePlayer(game.id, player.id);
      if (!gamePlayer || gamePlayer.has_answered) return;

      const question = await dbHelpers.getQuestion(game.current_question_id);
      const isCorrect = answer === question.correct_country;

      // Record the answer
      await dbHelpers.recordAnswer(game.current_question_id, player.id, answer, isCorrect);

      if (isCorrect) {
        // Update score
        await dbHelpers.updatePlayerScore(game.id, player.id, gamePlayer.score + 1);
        
        // Get updated game state
        const gameState = await dbHelpers.getGameState(game.id);
        io.to(roomId).emit("player-list", gameState);

        // Notify the user who got it right
        socket.emit("answer-result", {
          winner: player.username,
          correct: question.correct_country,
          isCorrect: true,
          text: `🎉 You got it right! The answer was ${question.correct_country}`
        });

        // Notify all other users
        socket.to(roomId).emit("answer-result", {
          winner: player.username,
          correct: question.correct_country,
          isCorrect: false,
          text: `⏹️ ${player.username} got it right! The answer was ${question.correct_country}`
        });

        // Generate next question after delay
        setTimeout(async () => {
          const nextQuestion = await generateQuestion(countries);
          const nextQuestionId = await dbHelpers.createQuestion(
            game.id,
            nextQuestion.correct.name,
            nextQuestion.correct.flag,
            nextQuestion.choices
          );
          await dbHelpers.updateGameQuestion(game.id, nextQuestionId);
          await dbHelpers.resetGameAnswers(game.id);
          io.to(roomId).emit("new-question", nextQuestion);
        }, 3000);
      } else {
        // Only emit to the incorrect player
        socket.emit("answer-result", {
          winner: null,
          correct: question.correct_country,
          isCorrect: false,
          text: `❌ Wrong answer! The correct answer was ${question.correct_country}`
        });

        // Check if all players have answered
        const allAnswered = await dbHelpers.checkAllPlayersAnswered(game.id);
        if (allAnswered) {
          // Show correct answer to everyone
          io.to(roomId).emit("show-correct-answer", {
            correct: question.correct_country,
            text: `The correct answer was ${question.correct_country}`
          });

          // Generate next question
          setTimeout(async () => {
            const nextQuestion = await generateQuestion(countries);
            const nextQuestionId = await dbHelpers.createQuestion(
              game.id,
              nextQuestion.correct.name,
              nextQuestion.correct.flag,
              nextQuestion.choices
            );
            await dbHelpers.updateGameQuestion(game.id, nextQuestionId);
            await dbHelpers.resetGameAnswers(game.id);
            io.to(roomId).emit("new-question", nextQuestion);
          }, 3000);
        }
      }
    } catch (error) {
      console.error("Error in submit-answer:", error);
      socket.emit("error", "Failed to submit answer. Please try again.");
    }
  });

  socket.on("time-up", async ({ roomId }) => {
    try {
      const game = await dbHelpers.getGame(roomId);
      if (!game) return;
      const question = await dbHelpers.getQuestion(game.current_question_id);
      io.to(roomId).emit("show-correct-answer", {
        correct: question.correct_country,
        text: `Time's up! The correct answer was ${question.correct_country}`
      });
      // Generate next question after delay
      setTimeout(async () => {
        const nextQuestion = await generateQuestion(countries);
        const nextQuestionId = await dbHelpers.createQuestion(
          game.id,
          nextQuestion.correct.name,
          nextQuestion.correct.flag,
          nextQuestion.choices
        );
        await dbHelpers.updateGameQuestion(game.id, nextQuestionId);
        await dbHelpers.resetGameAnswers(game.id);
        io.to(roomId).emit("new-question", nextQuestion);
      }, 3000);
    } catch (error) {
      console.error("Error in time-up:", error);
    }
  });

  // Remove player from all games on disconnect
  socket.on("disconnect", async () => {
    try {
      const player = await dbHelpers.getPlayerBySocketId(socket.id);
      if (player) {
        // Remove from all game_players entries
        await dbHelpers.removePlayerFromAllGames(player.id);
      }
    } catch (error) {
      console.error("Error cleaning up player on disconnect:", error);
    }
  });
});

server.listen(3001, '0.0.0.0',() => {
  console.log("Server running on port 3001");
});
