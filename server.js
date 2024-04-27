require("dotenv").config();
const express = require("express");
const bodyParser = require('body-parser');
const db = require('./db');
const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.json());

app.get("/config", (req, res) => {
  res.json({
    weatherApiKey: process.env.OPENWEATHERMAP_API_KEY,
    yelpApiKey: process.env.YELP_API_KEY, // Ensure you add this in your .env file
  });
});

// Assuming you have `node-fetch` installed and imported correctly
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

app.get("/search-restaurants", async (req, res) => {
  const { city, category } = req.query;
  try {
    // Fetch coordinates from OpenWeatherMap
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHERMAP_API_KEY}`
    );
    const weatherData = await weatherResponse.json();

    if (!weatherResponse.ok) {
      throw new Error(weatherData.message || "Error fetching location data.");
    }

    const coords = weatherData.coord;

    // Use coordinates to query Yelp
    const yelpResponse = await fetch(
      `https://api.yelp.com/v3/businesses/search?latitude=${coords.lat}&longitude=${coords.lon}&categories=${category}`,
      {
        headers: { Authorization: `Bearer ${process.env.YELP_API_KEY}` },
      }
    );
    const yelpData = await yelpResponse.json();

    if (!yelpResponse.ok) {
      throw new Error(
        yelpData.error?.description || "Error fetching Yelp data."
      );
    }

    res.json(yelpData);
  } catch (error) {
    console.error("API Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/submit-review", (req, res) => {
  const { restaurantId, rating, text } = req.body;
  const sql = `INSERT INTO reviews (restaurantId, rating, text) VALUES (?, ?, ?)`;
  const params = [restaurantId, rating, text];
  db.run(sql, params, function(err) {
    if (err) {
      return console.error(err.message);
      res.status(500).send(err.message);
    }
    res.status(201).json({ id: this.lastID, ...req.body });
  });
});

app.get("/restaurant-details/:restaurantId", (req, res) => {
  const { restaurantId } = req.params;
  const sql = "SELECT * FROM restaurants WHERE id = ?";
  const params = [restaurantId];
  db.get(sql, params, (err, row) => {
    if (err) {
      console.error("Error fetching restaurant details:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: "Restaurant not found" });
    }
  });
});


// Route to fetch reviews for a specific restaurant
app.get("/reviews/:restaurantId", (req, res) => {
  const { restaurantId } = req.params;
  const sql = "SELECT * FROM reviews WHERE restaurantId = ?";
  const params = [restaurantId];
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send(err.message);
      return;
    }
    res.status(200).json(rows);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});