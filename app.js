const express = require('express');
require('dotenv').config()
const morgan = require('morgan');
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const userRouter = require('./routers/userRouter');
const seedRouter = require('./routers/seedRouter');
const { errorResponse } = require('./controllers/responseController');
const authRouter = require('./routers/authRouter');
const categoryRouter = require('./routers/categoryRouter');
const productRouter = require('./routers/productRouter');
const app = express();

const rateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // set it 1 min
    max: 5, //Max 5 attempt 
    message: 'Too many request from this IP. Please try again later'
})


// middleware
app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(morgan('dev'));
// rate limiter
app.use(rateLimiter);

// router
app.use('/api/users', userRouter); //user router

// seed router
app.use('/api/seed', seedRouter);

// auth
app.use('/api/auth', authRouter);

// category
app.use('/api/categories', categoryRouter);

// product
app.use('/api/products', productRouter)


// Routes

app.get('/', (req, res) => {
    res.send('home shop server is running');
})

// userRouter.get('/', getUser)

// client error handling
app.use((req, res, next) => {
    createError(404, 'route not found!'); // triggering the error
    next()
})

// server error handling
app.use((err, req, res, next) => {
    return errorResponse(res, {
        statusCode: err.status,
        message: err.message,
    })
})

module.exports = { app };