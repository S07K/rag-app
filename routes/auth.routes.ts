import { Router } from "express"
import { validate } from "../middleware/validate"
import { requireAuth } from "../middleware/auth"
import { credentialsSchema } from "../schemas/auth.schema"
import { createAuthController } from "../controllers/auth.controller"
import type { AuthService } from "../services/auth.service"

export const createAuthRouter = (authService: AuthService) => {
    const router = Router()
    const controller = createAuthController(authService)

    router.post("/register", validate(credentialsSchema, "body"), controller.register)
    router.post("/login", validate(credentialsSchema, "body"), controller.login)
    router.post("/logout", controller.logout)
    router.get("/me", requireAuth(authService), controller.me)

    return router
}
