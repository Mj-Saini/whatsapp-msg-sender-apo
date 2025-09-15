// require('dotenv').config();  // Load environment variables from .env file

// const express = require('express');
// const puppeteer = require('puppeteer');

// const app = express();

// // Use environment variables for Puppeteer executable path and port
// const PORT = process.env.PORT || 8000;
// const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';  // Default path for Render

// app.use(express.json());

// // Test route to check if server is up
// app.get("/api/test", (req, res) => {
//   res.json({ message: "API working fine ✅" });
// });

// // Route to handle WhatsApp message sending
// app.post("/api/schedule-message", async (req, res) => {
//   const { number, messages, count, schedule } = req.body;

//   // Validate required fields
//   if (!number || !messages || !count || !schedule) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   // Validate schedule date
//   const dateObj = new Date(schedule);
//   if (isNaN(dateObj.getTime())) {
//     return res.status(400).json({ error: "Invalid schedule date/time" });
//   }

//   try {
//     console.log("Launching Puppeteer...");
//   const browser = await puppeteer.launch({
//   headless: 'new', // Use the new headless mode
//   args: [
//     '--no-sandbox',
//     '--disable-setuid-sandbox',
//     '--disable-dev-shm-usage',
//     '--disable-gpu',
//     '--single-process',
//     '--disable-software-rasterizer',
//   ],
// });

//     console.log("Browser launched, navigating to WhatsApp Web...");
//     const page = await browser.newPage();
//     await page.goto(`https://web.whatsapp.com/send?phone=${number}`);

//     let inputBox;
//     let retryCount = 0;

//     // Retry logic to find the input box
//     while (retryCount < 3) {
//       try {
//         console.log("Waiting for the message input box...");
//         inputBox = await page.waitForSelector('div._2A8P4', { visible: true, timeout: 20000 });
//         console.log("Message input box found!");
//         break;  // Exit loop if the element is found
//       } catch (err) {
//         console.log(`Error waiting for selector, attempt ${retryCount + 1}: ${err.message}`);
//         retryCount++;
//         if (retryCount === 3) {
//           console.error("Unable to find the input box after multiple attempts");
//           await browser.close();
//           return res.status(500).json({ error: "Unable to find the message input box after multiple attempts" });
//         }
//       }
//     }

//     // Loop through messages and send them
//     for (let i = 0; i < count; i++) {
//       for (const msg of messages) {
//         console.log("Typing message:", msg);
//         await page.type('div._2A8P4', msg); // Input the message
//         await page.keyboard.press('Enter'); // Press Enter to send
//         await new Promise(resolve => setTimeout(resolve, 1000)); // Add a delay between messages
//       }
//     }

//     console.log("Messages sent successfully.");
//     await browser.close();
//     res.json({
//       status: "success",
//       message: "Messages sent successfully"
//     });
//   } catch (err) {
//     console.error("Error:", err);
//     res.status(500).json({ error: "Internal server error", details: err.message });
//   }
// });

// // Set up dynamic port for Render (or fallback to local port)
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });



require('dotenv').config();  // Load environment variables from .env file

const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();

// Use environment variables for Puppeteer executable path and port
const PORT = process.env.PORT || 8000;
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;

app.use(express.json());

// Function to check if executable exists
const checkExecutable = (path) => {
  try {
    return fs.existsSync(path);
  } catch (err) {
    return false;
  }
};

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

  // Validate phone number format (basic validation)
  const cleanedNumber = number.replace(/\D/g, '');
  if (cleanedNumber.length < 10) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  try {
    console.log("Launching Puppeteer...");
    
    // Browser launch configuration
    const launchOptions = {
      headless: false, // Keep false for debugging, set to 'new' for production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,720',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ]
    };

    // Only use executablePath if it exists and is specified
    if (PUPPETEER_EXECUTABLE_PATH && checkExecutable(PUPPETEER_EXECUTABLE_PATH)) {
      launchOptions.executablePath = PUPPETEER_EXECUTABLE_PATH;
      console.log("Using custom browser path:", PUPPETEER_EXECUTABLE_PATH);
    } else {
      console.log("Using Puppeteer's built-in browser");
    }

    const browser = await puppeteer.launch(launchOptions);
    console.log("Browser launched successfully");

    const page = await browser.newPage();
    
    // Set longer timeouts for WhatsApp Web
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(30000);

    console.log("Navigating to WhatsApp Web...");
    await page.goto(`https://web.whatsapp.com/send?phone=${cleanedNumber}`, {
      waitUntil: 'networkidle2'
    });

    console.log("Waiting for WhatsApp Web to load...");

    // Wait for either QR code or chat interface
    let isLoggedIn = false;
    try {
      // Wait for QR code or chat interface with a longer timeout
      await page.waitForSelector('canvas[aria-label="Scan me!"], div[contenteditable="true"], div._2A8P4', { 
        timeout: 15000 
      });
      
      // Check if we need to scan QR code
      const qrCode = await page.$('canvas[aria-label="Scan me!"]');
      if (qrCode) {
        console.log("⚠️  Please scan the QR code in the browser window");
        // Wait for user to scan QR code (up to 2 minutes)
        await page.waitForSelector('div[contenteditable="true"], div._2A8P4', { 
          timeout: 120000 
        });
        console.log("✅ QR code scanned successfully");
      }
      
      isLoggedIn = true;
    } catch (err) {
      console.log("QR code or chat interface not immediately found, continuing...");
    }

    if (!isLoggedIn) {
      console.log("Waiting for any WhatsApp interface to load...");
      // Fallback: wait for any WhatsApp element
      await page.waitForSelector('body', { timeout: 10000 });
    }

    let inputBox;
    let retryCount = 0;
    const maxRetries = 5;

    // Retry logic to find the input box with multiple selectors
    while (retryCount < maxRetries) {
      try {
        console.log(`Looking for message input box (attempt ${retryCount + 1}/${maxRetries})...`);
        
        // Try multiple selectors for different WhatsApp Web versions
        const selectors = [
          'div[contenteditable="true"][title="Type a message"]',
          'div[contenteditable="true"]',
          'div._2A8P4',
          'footer div[contenteditable="true"]'
        ];

        for (const selector of selectors) {
          try {
            inputBox = await page.waitForSelector(selector, { 
              visible: true, 
              timeout: 5000 
            });
            if (inputBox) {
              console.log(`✅ Input box found using selector: ${selector}`);
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }

        if (!inputBox) {
          throw new Error("No input box found with any selector");
        }

        break; // Exit loop if found

      } catch (err) {
        retryCount++;
        console.log(`Attempt ${retryCount}/${maxRetries} failed: ${err.message}`);
        
        if (retryCount === maxRetries) {
          console.error("Unable to find the input box after multiple attempts");
          await browser.close();
          return res.status(500).json({ 
            error: "Unable to find message input box",
            details: "Please ensure you're logged into WhatsApp Web and try again"
          });
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Verify we can type in the input box
    try {
      await page.click('div[contenteditable="true"], div._2A8P4', { clickCount: 3 });
      await page.type('div[contenteditable="true"], div._2A8P4', ' ');
      await page.keyboard.press('Backspace');
    } catch (err) {
      console.log("Input box interaction test failed:", err.message);
    }

    // Loop through messages and send them
    console.log(`Sending ${count} sets of messages...`);
    
    for (let i = 0; i < count; i++) {
      console.log(`Sending message set ${i + 1}/${count}`);
      
      for (const msg of messages) {
        console.log("Typing message:", msg);
        
        try {
          // Clear input field first
          await page.click('div[contenteditable="true"], div._2A8P4', { clickCount: 3 });
          await page.keyboard.press('Backspace');
          
          // Type message
          await page.type('div[contenteditable="true"], div._2A8P4', msg);
          
          // Send message
          await page.keyboard.press('Enter');
          
          // Add a delay between messages
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (err) {
          console.error("Error sending message:", err.message);
          // Continue with next message
        }
      }
      
      // Add a longer delay between message sets
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log("Messages sent successfully.");
    await browser.close();
    
    res.json({
      status: "success",
      message: "Messages sent successfully",
      details: {
        number: cleanedNumber,
        messageCount: messages.length * count,
        scheduledFor: schedule
      }
    });

  } catch (err) {
    console.error("Error:", err);
    
    // Try to close browser if it exists
    try {
      if (browser) {
        await browser.close();
      }
    } catch (closeErr) {
      console.error("Error closing browser:", closeErr.message);
    }
    
    res.status(500).json({ 
      error: "Internal server error", 
      details: err.message,
      suggestion: "Please ensure WhatsApp Web is accessible and you're logged in"
    });
  }
});

// Set up dynamic port for Render (or fallback to local port)
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (PUPPETEER_EXECUTABLE_PATH) {
    console.log(`Using browser executable: ${PUPPETEER_EXECUTABLE_PATH}`);
  } else {
    console.log("Using Puppeteer's built-in browser");
  }
});