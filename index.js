require('dotenv').config();  // Load environment variables from .env file

const express = require('express');
const puppeteer = require('puppeteer');

const app = express();

// Use environment variables for Puppeteer executable path and port
const PORT = process.env.PORT || 8000;
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';  // Default path for Render

app.use(express.json());

// Test route to check if server is up
app.get("/api/test", (req, res) => {
  res.json({ message: "API working fine ✅" });
});

// Route to handle WhatsApp message sending
app.post("/api/schedule-message", async (req, res) => {
  const { number, messages, count, schedule } = req.body;

  // Validate required fields
  if (!number || !messages || !count || !schedule) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Validate schedule date
  const dateObj = new Date(schedule);
  if (isNaN(dateObj.getTime())) {
    return res.status(400).json({ error: "Invalid schedule date/time" });
  }

  try {
    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({
      headless: false, // Set to false to open a visible browser window
      executablePath: PUPPETEER_EXECUTABLE_PATH,  // Use the path from the environment variable
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // For cloud environments like Render
    });

    console.log("Browser launched, navigating to WhatsApp Web...");
    const page = await browser.newPage();
    await page.goto(`https://web.whatsapp.com/send?phone=${number}`);

    let inputBox;
    let retryCount = 0;

    // Retry logic to find the input box
    while (retryCount < 3) {
      try {
        console.log("Waiting for the message input box...");
        inputBox = await page.waitForSelector('div._2A8P4', { visible: true, timeout: 20000 });
        console.log("Message input box found!");
        break;  // Exit loop if the element is found
      } catch (err) {
        console.log(`Error waiting for selector, attempt ${retryCount + 1}: ${err.message}`);
        retryCount++;
        if (retryCount === 3) {
          console.error("Unable to find the input box after multiple attempts");
          await browser.close();
          return res.status(500).json({ error: "Unable to find the message input box after multiple attempts" });
        }
      }
    }

    // Loop through messages and send them
    for (let i = 0; i < count; i++) {
      for (const msg of messages) {
        console.log("Typing message:", msg);
        await page.type('div._2A8P4', msg); // Input the message
        await page.keyboard.press('Enter'); // Press Enter to send
        await new Promise(resolve => setTimeout(resolve, 1000)); // Add a delay between messages
      }
    }

    console.log("Messages sent successfully.");
    await browser.close();
    res.json({
      status: "success",
      message: "Messages sent successfully"
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Set up dynamic port for Render (or fallback to local port)
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
