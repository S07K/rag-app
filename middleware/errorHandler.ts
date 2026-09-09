import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {

    if(error instanceof AppError) {
        res.status(error.statusCode).json({
            error: error.message
        })

        return
    }

    console.error(error)

    res.status(500).json({
        error: "Internal Server Error"
    })
}