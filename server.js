
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

let rides = [
  { id: 1, rides: 'Bacoor to Kawit', price: 25 },
  { id: 2, rides: 'Bacoor to Imus', price: 30 },
];

let nextRideId = 3;

let bookings = [];
let nextBookingId = 1;

function validateRide(rideName, price) {
  return (
    typeof rideName === 'string' &&
    rideName.trim() !== '' &&
    price !== undefined &&
    price !== '' &&
    Number.isFinite(Number(price)) &&
    Number(price) >= 0
  );
}

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Padyak-All API is running.',
    rides: rides.length,
    bookings: bookings.length,
  });
});

app.get('/api/rides', (req, res) => {
  res.json(rides);
});


app.post('/api/rides', (req, res) => {
  const { rides: rideName, price } = req.body;

  if (!validateRide(rideName, price)) {
    return res.status(400).json({
      message: 'Valid ride name and price are required.',
    });
  }

  const newRide = {
    id: nextRideId++,
    rides: rideName.trim(),
    price: Number(price),
  };

  rides.push(newRide);

  console.log('Ride added:', newRide);

  res.status(201).json(newRide);
});

app.put('/api/rides/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = rides.findIndex((ride) => ride.id === id);

  if (index === -1) {
    return res.status(404).json({
      message: 'Ride not found.',
    });
  }

  const { rides: rideName, price } = req.body;

  if (!validateRide(rideName, price)) {
    return res.status(400).json({
      message: 'Valid ride name and price are required.',
    });
  }

  rides[index] = {
    id,
    rides: rideName.trim(),
    price: Number(price),
  };

  console.log('Ride updated:', rides[index]);

  res.json(rides[index]);
});

app.delete('/api/rides/:id', (req, res) => {
  const id = Number(req.params.id);
  const exists = rides.some((ride) => ride.id === id);

  if (!exists) {
    return res.status(404).json({
      message: 'Ride not found.',
    });
  }

  rides = rides.filter((ride) => ride.id !== id);

  console.log('Ride deleted - id:', id);

  res.json({
    message: 'Ride deleted.',
    id,
  });
});

app.get('/api/bookings', (req, res) => {
  res.json(bookings);
});

app.get('/api/bookings/:id', (req, res) => {
  const id = Number(req.params.id);
  const booking = bookings.find((item) => item.id === id);

  if (!booking) {
    return res.status(404).json({
      message: 'Booking not found.',
    });
  }

  res.json(booking);
});

app.post('/api/bookings', (req, res) => {
  const {
    pickup,
    dropoff,
    date,
    time,
    distance,
    duration,
    price,
    riderName,
    riderEmail,
  } = req.body;

  if (
    typeof pickup !== 'string' ||
    pickup.trim() === '' ||
    typeof dropoff !== 'string' ||
    dropoff.trim() === ''
  ) {
    return res.status(400).json({
      message: 'Pickup and drop-off locations are required.',
    });
  }

  if (pickup.trim() === dropoff.trim()) {
    return res.status(400).json({
      message: 'Pickup and drop-off must be different.',
    });
  }

  const bookingPrice =
    price !== undefined && price !== '' && Number.isFinite(Number(price))
      ? Number(price)
      : 0;

  if (bookingPrice < 0) {
    return res.status(400).json({
      message: 'Price cannot be negative.',
    });
  }

  const now = new Date();

  const newBooking = {
    id: nextBookingId++,
    pickup: pickup.trim(),
    dropoff: dropoff.trim(),
    date:
      date ||
      now.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
    time:
      time ||
      now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    distance: distance || '—',
    duration: duration || '—',
    price: bookingPrice,
    riderName:
      typeof riderName === 'string' && riderName.trim()
        ? riderName.trim()
        : 'Rider',
    riderEmail:
      typeof riderEmail === 'string' ? riderEmail.trim() : '',
    status: 'Pending',
    createdAt: now.toISOString(),
  };

  bookings.push(newBooking);

  console.log('Booking added:', newBooking);

  res.status(201).json(newBooking);
});

app.put('/api/bookings/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = bookings.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({
      message: 'Booking not found.',
    });
  }

  const { status } = req.body;
  const allowedStatuses = ['Pending', 'Completed', 'Cancelled'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: 'Status must be Pending, Completed, or Cancelled.',
    });
  }

  bookings[index] = {
    ...bookings[index],
    status,
    updatedAt: new Date().toISOString(),
  };

  console.log('Booking updated:', {
    id: bookings[index].id,
    pickup: bookings[index].pickup,
    dropoff: bookings[index].dropoff,
    status: bookings[index].status,
  });

  res.json(bookings[index]);
});

app.delete('/api/bookings/:id', (req, res) => {
  const id = Number(req.params.id);
  const exists = bookings.some((item) => item.id === id);

  if (!exists) {
    return res.status(404).json({
      message: 'Booking not found.',
    });
  }

  bookings = bookings.filter((item) => item.id !== id);

  console.log('Booking deleted - id:', id);

  res.json({
    message: 'Booking deleted.',
    id,
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, () => {
  console.log('===================================');
  console.log('Padyak-All server is running!');
  console.log(`Server URL: http://localhost:${PORT}`);
  console.log(`Test API:   http://localhost:${PORT}/api/test`);
  console.log(`Rides API:  http://localhost:${PORT}/api/rides`);
  console.log(`Bookings:   http://localhost:${PORT}/api/bookings`);
  console.log('===================================');
});
