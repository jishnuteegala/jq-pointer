import type { JsonValue } from "../lib/json-value";
import type { ModelNode, PathSegment } from "../lib/path-model";
import doc01 from "./01-github-repo-list.json";
import doc02 from "./02-github-issues-list.json";
import doc03 from "./03-stripe-charges-list.json";
import doc04 from "./04-stripe-customer.json";
import doc05 from "./05-k8s-pod.json";
import doc06 from "./06-k8s-pod-list.json";
import doc07 from "./07-k8s-deployment.json";
import doc08 from "./08-heterogeneous-array.json";
import doc09 from "./09-quoted-unicode-keys.json";
import doc10 from "./10-scalars-deep-nesting.json";

export interface CorpusScenario {
  id: string;
  document: JsonValue;
  clicks: PathSegment[][];
}

function key(name: string): PathSegment {
  return { kind: "key", key: name };
}

function index(at: number): PathSegment {
  return { kind: "index", index: at };
}

const documents: Record<string, JsonValue> = {
  "01-github-repo-list": doc01 as unknown as JsonValue,
  "02-github-issues-list": doc02 as unknown as JsonValue,
  "03-stripe-charges-list": doc03 as unknown as JsonValue,
  "04-stripe-customer": doc04 as unknown as JsonValue,
  "05-k8s-pod": doc05 as unknown as JsonValue,
  "06-k8s-pod-list": doc06 as unknown as JsonValue,
  "07-k8s-deployment": doc07 as unknown as JsonValue,
  "08-heterogeneous-array": doc08 as unknown as JsonValue,
  "09-quoted-unicode-keys": doc09 as unknown as JsonValue,
  "10-scalars-deep-nesting": doc10 as unknown as JsonValue,
};

export const corpusDocuments = documents;

export const firstClickPairScenarios: CorpusScenario[] = [
  {
    id: "01-github-repo-list",
    document: documents["01-github-repo-list"],
    clicks: [
      [index(0), key("name")],
      [index(1), key("name")],
    ],
  },
  {
    id: "02-github-issues-list",
    document: documents["02-github-issues-list"],
    clicks: [
      [index(0), key("id")],
      [index(1), key("id")],
    ],
  },
  {
    id: "03-stripe-charges-list",
    document: documents["03-stripe-charges-list"],
    clicks: [
      [key("data"), index(0), key("amount")],
      [key("data"), index(0), key("currency")],
    ],
  },
  {
    id: "04-stripe-customer",
    document: documents["04-stripe-customer"],
    clicks: [[key("id")], [key("email")]],
  },
  {
    id: "05-k8s-pod",
    document: documents["05-k8s-pod"],
    clicks: [
      [key("metadata"), key("name")],
      [key("metadata"), key("namespace")],
    ],
  },
  {
    id: "06-k8s-pod-list",
    document: documents["06-k8s-pod-list"],
    clicks: [
      [key("items"), index(0), key("metadata"), key("name")],
      [key("items"), index(1), key("metadata"), key("name")],
    ],
  },
  {
    id: "07-k8s-deployment",
    document: documents["07-k8s-deployment"],
    clicks: [
      [key("metadata"), key("name")],
      [key("metadata"), key("namespace")],
    ],
  },
  {
    id: "08-heterogeneous-array",
    document: documents["08-heterogeneous-array"],
    clicks: [
      [key("events"), index(0), key("type")],
      [key("events"), index(2), key("type")],
    ],
  },
  {
    id: "09-quoted-unicode-keys",
    document: documents["09-quoted-unicode-keys"],
    clicks: [[key("plain")], [key("with space")]],
  },
  {
    id: "10-scalars-deep-nesting",
    document: documents["10-scalars-deep-nesting"],
    clicks: [
      [key("tags"), index(0)],
      [key("tags"), index(1)],
    ],
  },
];

export function nodeAtSegments(root: ModelNode, segments: PathSegment[]): ModelNode {
  let current = root;
  for (const segment of segments) {
    const child = current.children?.find((candidate) => {
      if (candidate.segment === null) return false;
      if (segment.kind === "key")
        return candidate.segment.kind === "key" && candidate.segment.key === segment.key;
      return candidate.segment.kind === "index" && candidate.segment.index === segment.index;
    });
    if (child === undefined)
      throw new Error(`no node at ${segment.kind === "key" ? segment.key : segment.index}`);
    current = child;
  }
  return current;
}
