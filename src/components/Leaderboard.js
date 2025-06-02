import React, { useEffect, useState } from "react";
import "./Leaderboard.css";

const trophyIcons = [
  '🥇', // 1st
  '🥈', // 2nd
  '🥉', // 3rd
];

const Leaderboard = () => {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3001/api/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        setLeaders(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="leaderboard-card">Loading leaderboard...</div>;

  return (
    <div className="leaderboard-card">
      <h2 className="leaderboard-title">🏆 Global Leaderboard</h2>
      <ul className="leaderboard-list">
        {leaders.length === 0 && <li className="leaderboard-empty">No players yet!</li>}
        {leaders.map((player, idx) => (
          <li
            key={player.username}
            className={`leaderboard-row ${idx < 3 ? `top${idx + 1}` : ""}`}
          >
            <span className="leaderboard-rank">
              {trophyIcons[idx] || idx + 1}
            </span>
            <span className="leaderboard-user">
              <span className="avatar">{player.username[0]?.toUpperCase()}</span>
              <span className="username">{player.username}</span>
            </span>
            <span className="leaderboard-score">{player.total_score} pts</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Leaderboard; 