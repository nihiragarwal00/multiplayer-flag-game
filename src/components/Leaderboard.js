import React, { useState, useEffect } from 'react';
import './Leaderboard.css';

const API_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3001";

const trophyIcons = [
  '🥇', // 1st
  '🥈', // 2nd
  '🥉', // 3rd
];

const Leaderboard = () => {
  const [topPlayers, setTopPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${API_URL}/api/leaderboard`);
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }
        const data = await response.json();
        setTopPlayers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    // Refresh leaderboard every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="leaderboard-loading">Loading leaderboard...</div>;
  if (error) return <div className="leaderboard-error">Error loading leaderboard</div>;

  return (
    <div className="leaderboard-card">
      <h2 className="leaderboard-title">🏆 Global Leaderboard</h2>
      <ul className="leaderboard-list">
        {topPlayers.length === 0 && <li className="leaderboard-empty">No players yet!</li>}
        {topPlayers.map((player, idx) => (
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