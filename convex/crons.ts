import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
    "expire plans for overused accounts",
    { hourUTC: 0, minuteUTC: 5 },
    internal.plans.expirePlans
);

export default crons;
