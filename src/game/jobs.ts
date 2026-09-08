import { dailyContract } from "./progress";

export type JobKind = "hits" | "custard" | "pol" | "squirrel" | "don";

export type Job = {
  id: string;
  title: string;
  blurb: string;
  kind: JobKind;
  goal: number;
  radio: string;
};

export const JOBS: Job[] = [
  {
    id: "wake",
    title: "WAKE-UP CALL",
    blurb: "Decorate 5 walkers. The family is watching.",
    kind: "hits",
    goal: 5,
    radio: "Uncle Beaky: Kid. They never look up. Five walkers. Now.",
  },
  {
    id: "custard",
    title: "THE CUSTARD CONTRACT",
    blurb: "Ruin 2 cones before they finish the lick.",
    kind: "custard",
    goal: 2,
    radio: "Uncle Beaky: Soft serve. Two cones. Before they finish the lick.",
  },
  {
    id: "pols",
    title: "POLITICAL DONATION",
    blurb: "Glaze a politician. Make it civic.",
    kind: "pol",
    goal: 1,
    radio: "Uncle Beaky: There's a suit with a flag. Public service.",
  },
  {
    id: "nuts",
    title: "NUT JOB",
    blurb: "Wipe 6 squirrels out of Nut Quarter.",
    kind: "squirrel",
    goal: 6,
    radio: "Uncle Beaky: Tail-rats jumped out of the taffy shop. Remind them who flies.",
  },
  {
    id: "don",
    title: "SEND THE DON",
    blurb: "Find Don Nocciola. Flock optional. Make it messy.",
    kind: "don",
    goal: 1,
    radio: "Uncle Beaky: The Don's in Nut Quarter. Big tail. Gold chain.",
  },
];

export function jobList(): Job[] {
  const d = dailyContract();
  return [
    {
      id: "daily",
      title: d.title,
      blurb: d.blurb,
      kind: d.kind,
      goal: d.goal,
      radio: "Uncle Beaky: That's a cone on Custard Stretch. Don't think. Drop.",
    },
    ...JOBS,
  ];
}
