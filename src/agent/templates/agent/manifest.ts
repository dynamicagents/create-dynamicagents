import type { AgentSpec } from "../../spec";
import { render } from "../render";
import { quoted, stringProp } from "../text";
import source from "./manifest.ts.tpl";

interface Skill {
  id: string;
  name: string;
  description: string;
  tags: readonly string[];
}

const CHAT: Skill = {
  id: "chat",
  name: "Chat",
  description:
    "Answer the caller on a Workers AI model, calling tools when useful.",
  tags: ["chat", "assistant"]
};

const DELEGATE: Skill = {
  id: "delegate",
  name: "Research and self-contained work",
  description:
    "Hand self-contained pieces of a request to sub-agents, several at once when it splits cleanly, then compose their results into one answer.",
  tags: ["research", "delegation"]
};

const BROWSE: Skill = {
  id: "browse",
  name: "Browse the web",
  description:
    "Read and scrape live web pages — render a page as Markdown, extract structured data, or list its links.",
  tags: ["web", "browser"]
};

/** One skill as an element of the card's `skills`, laid out as prettier would. */
const skill = (it: Skill): string => {
  const props = [
    stringProp("id", it.id, 6),
    stringProp("name", it.name, 6),
    stringProp("description", it.description, 6),
    `      tags: [${it.tags.map(quoted).join(", ")}]`,
    "      examples: []",
    "      inputModes: []",
    "      outputModes: []",
    "      securityRequirements: []"
  ];
  return `    {\n${props.join(",\n")}\n    }`;
};

/**
 * `<dir>/manifest.ts` — the agent card.
 *
 * Its skills are the installed capabilities and nothing else: a card
 * advertising what the agent cannot do is worse than a short card. That makes
 * `skills` the one list here whose *number of elements* is computed, so it
 * stays composed and arrives as a block — and the card's name and description
 * are a block too, because a long description breaks after the colon.
 */
export function manifestTs(spec: AgentSpec): string {
  const skills = [
    CHAT,
    ...(spec.subAgent ? [DELEGATE] : []),
    ...(spec.capabilities.includes("browser") ? [BROWSE] : [])
  ];

  return render(source, {
    tokens: {
      /**
       * Trailing comma included, and it has to be: a block owns the separators
       * on its own boundaries, because `trailingComma: "none"` has prettier
       * strip a comma before what it reads as the last property, and a comment
       * marker is not a property it can read.
       */
      CARD_IDENTITY: `${[
        stringProp("name", spec.name),
        stringProp("description", spec.description)
      ].join(",\n")},`,
      SKILLS: skills.map(skill).join(",\n")
    }
  });
}
