import React, { useEffect, useState } from "react";
import "./App.css";
import MapChart from "./Map";
import { io } from "socket.io-client";
import PlayerStats from './components/PlayerStats';
import Leaderboard from './components/Leaderboard';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3001";
const socket = io(SOCKET_URL);

function App() {
  const [question, setQuestion] = useState(null);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState({});
  const [showStats, setShowStats] = useState(false);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = () => {
    if (username.trim()) {
      const newRoomId = generateRoomId();
      socket.emit("create-room", { roomId: newRoomId, username });
      setRoomId(newRoomId);
      setJoined(true);
    }
  };

  const handleJoinRoom = () => {
    if (roomInput.trim() && username.trim()) {
      socket.emit("join-room", { roomId: roomInput.trim(), username });
      setRoomId(roomInput.trim());
      setRoomInput("");
      setJoined(true);
    }
  };

  const handleUsernameSubmit = () => {
    if (usernameInput.trim()) {
      setUsername(usernameInput.trim());
      setUsernameInput("");
    }
  };

  useEffect(() => {
    socket.on("new-question", (q) => {
      setQuestion(q);
      setHasAnswered(false);
      setMessage("");
      setTimeLeft(10);
    });

    socket.on("answer-result", ({ winner, correct, isCorrect, text }) => {
      setHasAnswered(true);
      setMessage(text);
    });

    socket.on("show-correct-answer", ({ correct, text }) => {
      setMessage(text);
    });

    socket.on("player-list", (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    return () => {
      socket.off("new-question");
      socket.off("answer-result");
      socket.off("show-correct-answer");
      socket.off("player-list");
    };
  }, []);

  useEffect(() => {
    if (!hasAnswered && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !hasAnswered) {
      setHasAnswered(true);
      setMessage("Time's up!");
      if (roomId) {
        socket.emit("time-up", { roomId });
      }
    }
  }, [timeLeft, hasAnswered, roomId]);

  const handleChoice = (choice) => {
    if (hasAnswered) return;
    setHasAnswered(true);
    socket.emit("submit-answer", { roomId, answer: choice });
  };

  if (!joined) {
    return (
      <div className="App">
        <div className="join-card">
          <div className="join-title">Multiplayer Flag Game 🌍</div>
          <div className="username-section">
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="room-actions">
            <div className="create-room">
              <button 
                className="create-btn" 
                onClick={handleCreateRoom}
                disabled={!username.trim()}
              >
                Create New Room
              </button>
            </div>
            <div className="join-room">
              <input
                placeholder="Room ID"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                required
              />
              <button 
                className="join-btn" 
                onClick={handleJoinRoom}
                disabled={!username.trim() || !roomInput.trim()}
              >
                Join Room
              </button>
            </div>
          </div>
          <Leaderboard />
        </div>
      </div>
    );
  }

  if (!question) return <div>Loading question...</div>;

  return (
    <div className="App">
      {!username ? (
        <div className="username-container">
          <h1>Flag Game</h1>
          <div className="username-form">
            <input
              type="text"
              placeholder="Enter your username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleUsernameSubmit()}
            />
            <button onClick={handleUsernameSubmit}>Join Game</button>
          </div>
        </div>
      ) : !roomId ? (
        <div className="room-container">
          <Leaderboard />
          <h1>Welcome, {username}!</h1>
          <div className="room-form">
            <input
              type="text"
              placeholder="Enter room ID"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <button onClick={handleJoinRoom}>Join Room</button>
          </div>
          <button className="view-stats-btn" onClick={() => setShowStats(true)}>
            View My Statistics
          </button>
        </div>
      ) : showStats ? (
        <div className="stats-container">
          <button className="back-btn" onClick={() => setShowStats(false)}>
            Back to Game
          </button>
          <PlayerStats username={username} />
        </div>
      ) : (
        <div className="game-container">
          <div className="game-header">
            <div className="room-info">
              <h2>Room: {roomId}</h2>
              <div className="room-id-copy">
                <input
                  type="text"
                  value={roomId}
                  readOnly
                  className="room-id-input"
                />
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                    setMessage("Room ID copied to clipboard!");
                    setTimeout(() => setMessage(""), 2000);
                  }}
                >
                  Copy Room ID
                </button>
              </div>
            </div>
            <div className="player-list">
              {Object.values(
                Object.values(players).reduce((acc, player) => {
                  acc[player.username] = player;
                  return acc;
                }, {})
              ).map((player) => (
                <div key={player.username} className="player-item">
                  <span className="player-name">{player.username}</span>
                  <span className="player-score">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="game-content">
            <div className="quiz-section">
              {question && (
                <div className="question-container">
                  <div className="timer">Time Left: {timeLeft}s</div>
                  <img
                    src={question.correct.flag}
                    alt="Flag"
                    className="flag-image"
                  />
                  <div className="choices">
                    {question.choices.map((choice) => (
                      <button
                        key={choice}
                        onClick={() => handleChoice(choice)}
                        disabled={hasAnswered}
                        className={`choice-button ${hasAnswered ? 'disabled' : ''}`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {message && (
                <div className="message">
                  {message}
                </div>
              )}
            </div>
            <div className="map-section">
              <h3>Where is it on the map?</h3>
              <div className="map-container">
                <MapChart highlightedCountry={question?.correct.name} />
              </div>
            </div>
          </div>
          <button className="view-stats-btn" onClick={() => setShowStats(true)}>
            View My Statistics
          </button>
        </div>
      )}
    </div>
  );
}

export default App;