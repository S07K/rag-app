import { type Request, type Response } from 'express'
import checkHealth from '../services/healthService'

export const appController = (req: Request, res: Response) => {
    const response = checkHealth()

    res.json(response)
}