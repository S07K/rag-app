import express from 'express'
import healthRouter from './routes/health'
import { Config } from './config'
import HomeRouter from './routes/home'
import { errorHandler } from './middleware/errorHandler'
import { notFoundHandler } from './middleware/notFoundHandler'

const app = express()
const PORT = Config.PORT

app.use(HomeRouter)

app.use(healthRouter)

app.use(notFoundHandler)

app.use(errorHandler)


app.listen(PORT, () => {
    console.log("Server is listening on port", PORT)
})