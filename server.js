const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();

const PORT = process.env.PORT || 8080;
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "padyak_all_db";

let pool = null;
let useMemoryDb = false;
let nextMemoryId = 4;

let memoryBookings = [
  {
    id: 1,
    pickup: "Plaza Rizal",
    dropoff: "Public Market",
    date: "2026-11-23",
    time: "08:30 AM",
    distance: "2.4 km",
    duration: "10 mins",
    price: 45.0,
    paymentMethod: "Cash",
    riderName: "Juan Dela Cruz",
    riderEmail: "juan@example.com",
    status: "Pending",
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    pickup: "School Gate",
    dropoff: "Town Proper",
    date: "2026-11-22",
    time: "02:15 PM",
    distance: "3.8 km",
    duration: "15 mins",
    price: 65.0,
    paymentMethod: "GCash",
    riderName: "Maria Santos",
    riderEmail: "maria@example.com",
    status: "Completed",
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    pickup: "Barangay Hall",
    dropoff: "Terminal",
    date: "2026-11-21",
    time: "05:00 PM",
    distance: "1.9 km",
    duration: "8 mins",
    price: 35.0,
    paymentMethod: "Cash",
    riderName: "Pedro Reyes",
    riderEmail: "pedro@example.com",
    status: "Cancelled",
    created_at: new Date().toISOString()
  }
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === "http://localhost:5173" ||
        origin === "http://127.0.0.1:5173" ||
        origin.endsWith(".netlify.app")
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());

async function initializeDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: DB_USER,
      password: DB_PASSWORD,
      connectTimeout: 5000,
      ...(process.env.DB_SSL === "true"
        ? { ssl: { rejectUnauthorized: false } }
        : {})
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``
    );

    await connection.end();

    pool = mysql.createPool({
      host: DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ...(process.env.DB_SSL === "true"
        ? { ssl: { rejectUnauthorized: false } }
        : {})
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

    useMemoryDb = false;
    console.log(`Connected to MySQL database: ${DB_NAME}`);
  } catch (error) {
    useMemoryDb = true;
    pool = null;
    console.warn(
      "MySQL unavailable. Running in temporary in-memory mode:",
      error.message
    );
  }
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Padyak-All API is running.",
    storage: useMemoryDb ? "in-memory" : "mysql"
  });
});

app.get("/api/test", async (req, res) => {
  if (useMemoryDb) {
    return res.json({
      success: true,
      storage: "in-memory",
      message: "Backend is running in temporary in-memory mode (no DB)."
    });
  }

  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      storage: "mysql",
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

    if (useMemoryDb) {
      const rows = riderEmail
        ? memoryBookings.filter(
            (b) =>
              String(b.riderEmail).toLowerCase() ===
              String(riderEmail).trim().toLowerCase()
          )
        : memoryBookings;

      return res.json([...rows].reverse());
    }

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

    if (useMemoryDb) {
      const found = memoryBookings.find((b) => Number(b.id) === id);
      if (!found) {
        return res.status(404).json({
          success: false,
          message: "Booking not found."
        });
      }
      return res.json(found);
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

    if (useMemoryDb) {
      const created = {
        id: nextMemoryId++,
        pickup: String(pickup).trim(),
        dropoff: String(dropoff).trim(),
        date: String(date).trim(),
        time: String(time).trim(),
        distance: distance ?? "",
        duration: duration ?? "",
        price: Number(price),
        paymentMethod: paymentMethod || "Cash",
        riderName: riderName || "",
        riderEmail: String(riderEmail).trim(),
        status: "Pending",
        created_at: new Date().toISOString()
      };

      memoryBookings.push(created);

      return res.status(201).json({
        success: true,
        message: "Booking created successfully.",
        booking: created
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

    if (useMemoryDb) {
      const index = memoryBookings.findIndex((b) => Number(b.id) === id);
      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: "Booking not found."
        });
      }

      memoryBookings[index] = {
        ...memoryBookings[index],
        status
      };

      return res.json({
        success: true,
        message: "Booking status updated successfully.",
        booking: memoryBookings[index]
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

    if (useMemoryDb) {
      const exists = memoryBookings.some((b) => Number(b.id) === id);
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "Booking not found."
        });
      }

      memoryBookings = memoryBookings.filter((b) => Number(b.id) !== id);

      return res.json({
        success: true,
        message: "Booking deleted successfully."
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
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Padyak-All backend running at http://localhost:${PORT}`);
  });
}

startServer();