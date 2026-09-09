import { Router } from "express";
import { homeController } from "../controllers/homeController";

const HomeRouter = Router()

HomeRouter.get('/', homeController)

export default HomeRouter