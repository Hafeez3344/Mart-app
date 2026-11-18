const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PG_BIN = 'F:\\pg17\\pgsql\\bin';
const BACKUP_DIR = path.resolve(__dirname, '..', 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Creates a timestamped PostgreSQL backup using pg_dump
 */
function createDatabaseBackup() {
  return new Promise((resolve, reject) => {
    ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `mart_pos_backup_${timestamp}.sql`);
    const pgDump = path.join(PG_BIN, 'pg_dump.exe');

    if (!fs.existsSync(pgDump)) {
      return reject(new Error(`pg_dump.exe not found at ${pgDump}`));
    }

    const cmd = `"${pgDump}" -h localhost -p 5432 -U postgres -d mart_pos_db -F p -f "${backupFile}"`;

    exec(
      cmd,
      {
        env: {
          ...process.env,
          PGPASSWORD: 'admin123',
          PATH: `${PG_BIN};${process.env.PATH}`
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }

        const stats = fs.existsSync(backupFile) ? fs.statSync(backupFile) : null;
        resolve({
          success: true,
          filePath: backupFile,
          fileName: path.basename(backupFile),
          sizeBytes: stats ? stats.size : 0,
          timestamp: new Date().toISOString()
        });
      }
    );
  });
}

module.exports = {
  createDatabaseBackup,
  BACKUP_DIR
};

