import React, { useState, useEffect } from 'react';
import './PlayerStats.css';

const API_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3001";

const PlayerStats = ({ username }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, gamesRes, questionsRes] = await Promise.all([
          fetch(`${API_URL}/api/player/${username}/stats`),
          fetch(`${API_URL}/api/player/${username}/games`),
          fetch(`${API_URL}/api/player/${username}/questions`)
        ]);

        if (!statsRes.ok || !gamesRes.ok || !questionsRes.ok) {
          throw new Error('Failed to fetch player stats');
        }

        const [statsData, gamesData, questionsData] = await Promise.all([
          statsRes.json(),
          gamesRes.json(),
          questionsRes.json()
        ]);

        setStats({
          ...statsData,
          games: gamesData,
          questions: questionsData
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [username]);

  if (loading) return <div className="stats-loading">Loading stats...</div>;
  if (error) return <div className="stats-error">Error loading stats</div>;
  if (!stats) return null;

  return (
    <div className="stats-card">
      <h2 className="stats-title">Player Statistics</h2>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">Games Played</span>
          <span className="stat-value">{stats.games_played}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Score</span>
          <span className="stat-value">{stats.total_score}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Correct Answers</span>
          <span className="stat-value">{stats.correct_answers}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Accuracy</span>
          <span className="stat-value">{stats.accuracy}%</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerStats; 