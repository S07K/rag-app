import { Router } from 'express'
import { appController } from '../controllers/appController'

const healthRouter = Router()

healthRouter.get('/health', appController)

export default healthRouter