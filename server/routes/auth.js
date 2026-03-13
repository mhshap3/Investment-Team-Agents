const express = require("express");
const router  = express.Router();
const { google } = require("googleapis");

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "https://investment-team-agents-production.up.railway.app/auth/callback"
  );
}

// Step 1: Redirect to Google OAuth consent screen
router.get("/gmail", (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt:      "consent", // force refresh token every time
    scope:       ["https://www.googleapis.com/auth/gmail.readonly"],
  });
  res.redirect(url);
});

// Step 2: Google redirects back here with a code
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing auth code.");

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // Show the refresh token so you can copy it into Railway Variables
    res.send(`
      <h2>Gmail Authorization Successful!</h2>
      <p>Copy this refresh token and add it to Railway as <strong>GMAIL_REFRESH_TOKEN</strong>:</p>
      <textarea rows="4" cols="80" onclick="this.select()">${tokens.refresh_token}</textarea>
      <p>Once added to Railway Variables, redeploy and you're done!</p>
    `);
  } catch (err) {
    res.status(500).send(`Auth failed: ${err.message}`);
  }
});

module.exports = router;
