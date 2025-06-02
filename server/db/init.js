const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Create db directory if it doesn't exist
const dbDir = path.join(__dirname, "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(path.join(dbDir, "flag_game.db"));

// Read and execute schema
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema, (err) => {
  if (err) {
    console.error("Error creating tables:", err);
  } else {
    console.log("Database tables created successfully");
  }
});

// Helper functions for database operations
const dbHelpers = {
  // Game operations
  createGame: (roomId) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO games (room_id, status) VALUES (?, 'active')",
        [roomId],
        function (err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });
  },

  getGame: (roomId) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM games WHERE room_id = ? AND status = 'active'",
        [roomId],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
  },

  // Player operations
  createPlayer: (username, socketId) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO players (username, socket_id) VALUES (?, ?)",
        [username, socketId],
        function (err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });
  },

  addPlayerToGame: (gameId, playerId) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO game_players (game_id, player_id, score) VALUES (?, ?, 0)",
        [gameId, playerId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  },

  // Question operations
  createQuestion: (gameId, correctCountry, flagUrl, choices) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO questions (game_id, correct_country, flag_url, choices) VALUES (?, ?, ?, ?)",
        [gameId, correctCountry, flagUrl, JSON.stringify(choices)],
        function (err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });
  },

  // Answer operations
  recordAnswer: (questionId, playerId, answer, isCorrect) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO answers (question_id, player_id, answer, is_correct) VALUES (?, ?, ?, ?)",
        [questionId, playerId, answer, isCorrect],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  },

  updatePlayerScore: (gameId, playerId, newScore) => {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE game_players SET score = ? WHERE game_id = ? AND player_id = ?",
        [newScore, gameId, playerId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  },

  // Game state operations
  getGameState: (gameId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.username, p.socket_id, gp.score 
         FROM game_players gp 
         JOIN players p ON gp.player_id = p.id 
         WHERE gp.game_id = ?`,
        [gameId],
        (err, rows) => {
          if (err) reject(err);
          const players = {};
          rows.forEach((row) => {
            players[row.socket_id] = {
              username: row.username,
              score: row.score,
            };
          });
          resolve(players);
        }
      );
    });
  },

  updateGameQuestion: (gameId, questionId) => {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE games SET current_question_id = ? WHERE id = ?",
        [questionId, gameId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  },

  getQuestion: (questionId) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM questions WHERE id = ?", [questionId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  },

  getPlayerBySocketId: (socketId) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM players WHERE socket_id = ?",
        [socketId],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
  },

  getGamePlayer: (gameId, playerId) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM game_players WHERE game_id = ? AND player_id = ?",
        [gameId, playerId],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
  },

  getGameByPlayerId: (playerId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT g.* FROM games g 
         JOIN game_players gp ON g.id = gp.game_id 
         WHERE gp.player_id = ? AND g.status = 'active'`,
        [playerId],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
  },

  // Remove player from all games (for disconnect cleanup)
  removePlayerFromAllGames: (playerId) => {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM game_players WHERE player_id = ?`,
        [playerId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  },

  checkAllPlayersAnswered: (gameId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(DISTINCT gp.player_id) as total_players,
                COUNT(DISTINCT a.player_id) as answered_players
         FROM game_players gp
         LEFT JOIN questions q ON gp.game_id = q.game_id
         LEFT JOIN answers a ON q.id = a.question_id AND gp.player_id = a.player_id
         WHERE gp.game_id = ?`,
        [gameId],
        (err, row) => {
          if (err) reject(err);
          resolve(row.total_players === row.answered_players);
        }
      );
    });
  },

  resetGameAnswers: (gameId) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE game_players 
         SET has_answered = 0 
         WHERE game_id = ?`,
        [gameId],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  },

  // Analytics helper functions
  getPlayerStats: (username) => {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          p.id,
          p.username,
          COUNT(DISTINCT gp.game_id) as total_games,
          SUM(gp.score) as total_score,
          COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.question_id END) as correct_answers,
          COUNT(DISTINCT a.question_id) as total_answers,
          ROUND(AVG(gp.score), 2) as avg_score_per_game,
          ROUND(CAST(COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.question_id END) AS FLOAT) / 
                NULLIF(COUNT(DISTINCT a.question_id), 0) * 100, 2) as accuracy_percentage
        FROM players p
        LEFT JOIN game_players gp ON p.id = gp.player_id
        LEFT JOIN questions q ON gp.game_id = q.game_id
        LEFT JOIN answers a ON q.id = a.question_id AND p.id = a.player_id
        WHERE p.username = ?
        GROUP BY p.id, p.username
      `, [username], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  },

  getPlayerGameHistory: (username) => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          g.id as game_id,
          g.room_id,
          g.created_at as game_started,
          gp.score,
          COUNT(DISTINCT q.id) as total_questions,
          COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.question_id END) as correct_answers
        FROM players p
        JOIN game_players gp ON p.id = gp.player_id
        JOIN games g ON gp.game_id = g.id
        LEFT JOIN questions q ON g.id = q.game_id
        LEFT JOIN answers a ON q.id = a.question_id AND p.id = a.player_id
        WHERE p.username = ?
        GROUP BY g.id, g.room_id, g.created_at, gp.score
        ORDER BY g.created_at DESC
      `, [username], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
  },

  getPlayerQuestionHistory: (username) => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          q.correct_country,
          q.flag_url,
          a.answer,
          a.is_correct,
          a.answered_at,
          g.room_id
        FROM players p
        JOIN answers a ON p.id = a.player_id
        JOIN questions q ON a.question_id = q.id
        JOIN games g ON q.game_id = g.id
        WHERE p.username = ?
        ORDER BY a.answered_at DESC
      `, [username], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
  }
};

module.exports = { dbHelpers }; 