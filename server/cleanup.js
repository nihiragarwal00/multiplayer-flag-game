const fs = require('fs');
const path = require('path');

// Database file paths
const DB_FILE = path.join(__dirname, 'db', 'flag_game.db');
const DB_WAL = path.join(__dirname, 'db', 'flag_game.db-wal');
const DB_SHM = path.join(__dirname, 'db', 'flag_game.db-shm');

// Function to delete a file if it exists
function deleteFileIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`Deleted: ${filePath}`);
    } catch (err) {
      console.error(`Error deleting ${filePath}:`, err);
    }
  }
}

// Delete all database files
console.log('Cleaning up database files...');
deleteFileIfExists(DB_FILE);
deleteFileIfExists(DB_WAL);
deleteFileIfExists(DB_SHM);
console.log('Cleanup complete!'); 