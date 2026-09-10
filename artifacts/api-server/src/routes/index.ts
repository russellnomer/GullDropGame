import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gullDropRouter from "./gull-drop";
import gullDropProfileRouter from "./gull-drop-profile";
import gullDropLeaderboardRouter from "./gull-drop-leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gullDropRouter);
router.use(gullDropProfileRouter);
router.use(gullDropLeaderboardRouter);

export default router;
