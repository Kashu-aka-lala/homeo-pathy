const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoDir = '/Users/mc/Desktop/Yashfeen /homeo-pathy';

// Remove loose jpeg from root if exists
const rootJpeg = path.join(repoDir, 'FarooqHomeopathic.jpeg');
if (fs.existsSync(rootJpeg)) {
    fs.unlinkSync(rootJpeg);
    console.log('Removed loose root FarooqHomeopathic.jpeg');
}

try {
    console.log('Staging files...');
    execSync('git add .', { cwd: repoDir, stdio: 'inherit' });

    console.log('Committing changes...');
    execSync('git commit -m "Update clinic to Farooq Homeopathic: update names, contact, bank info, logo, and docs"', { cwd: repoDir, stdio: 'inherit' });

    console.log('Pushing to GitHub repo https://github.com/Kashu-aka-lala/homeo-pathy.git...');
    execSync('git push origin main || git push origin master', { cwd: repoDir, stdio: 'inherit' });

    console.log('Git push completed successfully!');
} catch (err) {
    console.error('Git error:', err.message);
    process.exit(1);
}
