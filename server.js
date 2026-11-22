
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();

const PORT = process.env.PORT || 8080;
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "padyak_all_db";

let pool;

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``
  );

  await connection.end();

  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pickup VARCHAR(255) NOT NULL,
      dropoff VARCHAR(255) NOT NULL,
      date VARCHAR(100) NOT NULL,
      time VARCHAR(100) NOT NULL,
      distance VARCHAR(100) DEFAULT '',
      duration VARCHAR(100) DEFAULT '',
      price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      paymentMethod VARCHAR(50) DEFAULT 'Cash',
      riderName VARCHAR(255) DEFAULT '',
      riderEmail VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = [
    ["distance", "VARCHAR(100) DEFAULT ''"],
    ["duration", "VARCHAR(100) DEFAULT ''"],
    ["paymentMethod", "VARCHAR(50) DEFAULT 'Cash'"],
    ["riderName", "VARCHAR(255) DEFAULT ''"],
    ["riderEmail", "VARCHAR(255) NOT NULL DEFAULT ''"],
    ["status", "VARCHAR(50) NOT NULL DEFAULT 'Pending'"],
    ["created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"]
  ];

  for (const [column, definition] of columns) {
    const [existing] = await pool.query(
      `SHOW COLUMNS FROM bookings LIKE ?`,
      [column]
    );

    if (existing.length === 0) {
      await pool.query(
        `ALTER TABLE bookings ADD COLUMN \`${column}\` ${definition}`
      );
    }
  }

  console.log(`Connected to MySQL database: ${DB_NAME}`);
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Padyak-All API is running."
  });
});

app.get("/api/test", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "Backend and MySQL connection are working."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed."
    });
  }
});

app.get("/api/bookings", async (req, res) => {
  try {
    const { riderEmail } = req.query;

    let sql = "SELECT * FROM bookings";
    let values = [];

    if (riderEmail) {
      sql += " WHERE riderEmail = ?";
      values.push(String(riderEmail).trim());
    }

    sql += " ORDER BY created_at DESC, id DESC";

    const [bookings] = await pool.query(sql, values);

    res.json(bookings);
  } catch (error) {
    console.error("Fetch bookings error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch bookings."
    });
  }
});

app.get("/api/bookings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID."
      });
    }

    const [bookings] = await pool.query(
      "SELECT * FROM bookings WHERE id = ?",
      [id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    res.json(bookings[0]);
  } catch (error) {
    console.error("Fetch booking error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch booking."
    });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const {
      pickup,
      dropoff,
      date,
      time,
      distance,
      duration,
      price,
      paymentMethod,
      riderName,
      riderEmail
    } = req.body;

    if (
      !pickup ||
      !dropoff ||
      !date ||
      !time ||
      !riderEmail ||
      price === undefined ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required booking details."
      });
    }

    const [result] = await pool.query(
      `INSERT INTO bookings
      (
        pickup,
        dropoff,
        date,
        time,
        distance,
        duration,
        price,
        paymentMethod,
        riderName,
        riderEmail,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(pickup).trim(),
        String(dropoff).trim(),
        String(date).trim(),
        String(time).trim(),
        distance ?? "",
        duration ?? "",
        Number(price),
        paymentMethod || "Cash",
        riderName || "",
        String(riderEmail).trim(),
        "Pending"
      ]
    );

    const [bookings] = await pool.query(
      "SELECT * FROM bookings WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      booking: bookings[0]
    });
  } catch (error) {
    console.error("Create booking error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create booking."
    });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "Pending",
      "Completed",
      "Cancelled"
    ];

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status."
      });
    }

    const [result] = await pool.query(
      "UPDATE bookings SET status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    const [bookings] = await pool.query(
      "SELECT * FROM bookings WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Booking status updated successfully.",
      booking: bookings[0]
    });
  } catch (error) {
    console.error("Update booking error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update booking."
    });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID."
      });
    }

    const [result] = await pool.query(
      "DELETE FROM bookings WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    res.json({
      success: true,
      message: "Booking deleted successfully."
    });
  } catch (error) {
    console.error("Delete booking error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete booking."
    });
  }
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Padyak-All backend running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
}

startServer();
