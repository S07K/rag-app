import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/AppError";

export const validate =
  (schema: ZodType, source: "body" | "params" | "query") =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const issues = result.error.issues;
      const message = issues
        .map((i) => {
          return `${i.path.join(".")}: ${i.message}`;
        })
        .join(", ");
      return next(new AppError(400, message));
    }

    req[source] = result.data
    next()
  };
