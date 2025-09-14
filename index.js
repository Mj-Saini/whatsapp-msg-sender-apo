

// const express = require("express");
// const app = express();
// const bodyParser = require("body-parser");

// // Enable body parsing to handle JSON data
// app.use(bodyParser.json());

// // In-memory storage for scheduled messages (we'll use an array for simplicity)
// const scheduledMessages = [];

// // Test route
// app.get("/api/test", (req, res) => {
//   res.json({ message: "API working fine ✅ on port 8000" });
// });

// // API route to store the data from frontend
// app.post("/api/schedule-message", (req, res) => {
//   const { number, messages, count, schedule } = req.body;

//   if (!number || !messages || !count || !schedule) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   // Log the incoming data
//   console.log("Data received:", req.body);

//   // Return success response
//   res.json({ status: "success", message: "Data stored successfully" });
// });


// // Server listen on port 8000
// const PORT = 8000;
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });



const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 8000;

// Enable body parsing for JSON data
app.use(express.json());

// Route to directly send WhatsApp message
app.post("/api/schedule-message", async (req, res) => {
  const { number, messages, count, schedule } = req.body;

  // Validation of incoming data
  if (!number || !messages || !count || !schedule) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const dateObj = new Date(schedule);
  if (isNaN(dateObj.getTime())) {
    return res.status(400).json({ error: "Invalid schedule date/time" });
  }

  try {
    // Launch Puppeteer to control WhatsApp Web
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Open WhatsApp Web
    await page.goto("https://web.whatsapp.com");

    // Wait for the page to load and user to scan the QR code
    await page.waitForSelector('._3FRCZ', { timeout: 0 });  // This ensures the QR code is scanned

    // Navigate directly to the chat page
    await page.goto(`https://web.whatsapp.com/send?phone=${number}`);

    // Wait for the message input box to be visible
    const msgInputSelector = 'div._2A8P4'; // This selector might need to be updated
    await page.waitForSelector(msgInputSelector, { timeout: 60000 });

    // Loop through the messages and send them
    for (let i = 0; i < count; i++) {
      for (const msg of messages) {
        await page.type(msgInputSelector, msg);
        await page.keyboard.press("Enter");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay between messages
      }
    }

    // Close the browser after sending the messages
    console.log("Messages sent successfully.");
    await browser.close();

    // Respond with success
    res.json({
      status: "success",
      message: "Message sent successfully without storing data!",
    });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
