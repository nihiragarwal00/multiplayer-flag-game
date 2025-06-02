import React, { useState, useEffect } from 'react';
import './PlayerStats.css';

const PlayerStats = ({ username }) => {
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, gamesRes, questionsRes] = await Promise.all([
          fetch(`http://localhost:3001/api/player/${username}/stats`),
          fetch(`http://localhost:3001/api/player/${username}/games`),
          fetch(`http://localhost:3001/api/player/${username}/questions`)
        ]);

        if (!statsRes.ok) throw new Error('Failed to fetch stats');
        if (!gamesRes.ok) throw new Error('Failed to fetch games');
        if (!questionsRes.ok) throw new Error('Failed to fetch questions');

        const [statsData, gamesData, questionsData] = await Promise.all([
          statsRes.json(),
          gamesRes.json(),
          questionsRes.json()
        ]);

        setStats(statsData);
        setGames(gamesData);
        setQuestions(questionsData);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchData();
    }
  }, [username]);

  if (loading) return <div className="stats-loading">Loading statistics...</div>;
  if (error) return <div className="stats-error">Error: {error}</div>;
  if (!stats) return <div className="stats-error">No statistics found</div>;

  return (
    <div className="player-stats">
      <h2>Player Statistics: {username}</h2>
      
      <div className="stats-overview">
        <div className="stat-card">
          <h3>Overall Performance</h3>
          <div className="stat-grid">
            <div className="stat-item">
              <span className="stat-label">Total Games</span>
              <span className="stat-value">{stats.total_games}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Score</span>
              <span className="stat-value">{stats.total_score}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Average Score</span>
              <span className="stat-value">{stats.avg_score_per_game}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Accuracy</span>
              <span className="stat-value">{stats.accuracy_percentage}%</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <h3>Recent Games</h3>
          <div className="games-list">
            {games.slice(0, 5).map((game) => (
              <div key={game.game_id} className="game-item">
                <div className="game-info">
                  <span className="game-room">Room: {game.room_id}</span>
                  <span className="game-date">
                    {new Date(game.game_started).toLocaleDateString()}
                  </span>
                </div>
                <div className="game-stats">
                  <span>Score: {game.score}</span>
                  <span>Correct: {game.correct_answers}/{game.total_questions}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stat-card">
          <h3>Recent Questions</h3>
          <div className="questions-list">
            {questions.slice(0, 5).map((q, index) => (
              <div key={index} className="question-item">
                <img src={q.flag_url} alt={q.correct_country} className="flag-thumbnail" />
                <div className="question-info">
                  <span className="country-name">{q.correct_country}</span>
                  <span className={`answer-status ${q.is_correct ? 'correct' : 'incorrect'}`}>
                    {q.is_correct ? '✓' : '✗'} {q.answer}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerStats; 