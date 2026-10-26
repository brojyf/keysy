import { useRef, useState, type KeyboardEvent } from "react";
import { DesignAsset } from "./DesignAsset";
import { ComingSoon } from "./SiteChrome";

const samples = [
  {
    language: "Go",
    icon: "imgIconGo",
    code: `import "github.com/keysy/sdk-go/keysy"

func main() {
    client := keysy.NewClient() // uses KEYSY_TOKEN

    dbURL, err := client.Get(ctx, "production/api/DATABASE_URL")
    if err != nil {
        log.Fatal(err)
    }
    db, _ := sql.Open("postgres", dbURL)
}`,
  },
  {
    language: "TypeScript",
    icon: "imgIconTypescript",
    code: `import { Keysy } from "@keysy/sdk"

const keysy = new Keysy() // uses KEYSY_TOKEN

const dbUrl = await keysy.get("production/api/DATABASE_URL")
const db = new Pool({ connectionString: dbUrl })`,
  },
  {
    language: "Python",
    icon: "imgIconPython",
    code: `from keysy import Keysy

keysy = Keysy()  # uses KEYSY_TOKEN

db_url = keysy.get("production/api/DATABASE_URL")
db = psycopg.connect(db_url)`,
  },
  {
    language: "Rust",
    icon: "imgIconRust",
    code: `use keysy::Client;

let keysy = Client::new()?; // uses KEYSY_TOKEN

let db_url = keysy.get("production/api/DATABASE_URL").await?;
let pool = PgPool::connect(&db_url).await?;`,
  },
  {
    language: "Java",
    icon: "imgIconOpenjdk",
    code: `import dev.keysy.Keysy;

var keysy = Keysy.create(); // uses KEYSY_TOKEN

String dbUrl = keysy.get("production/api/DATABASE_URL");
var db = DriverManager.getConnection(dbUrl);`,
  },
  {
    language: "C#",
    icon: "imgIconDotnet",
    code: `using Keysy;

var keysy = new KeysyClient(); // uses KEYSY_TOKEN

var dbUrl = await keysy.GetAsync("production/api/DATABASE_URL");
await using var db = new NpgsqlConnection(dbUrl);`,
  },
];

export function SyntaxCode({ code }: { code: string }) {
  return (
    <code>
      {code
        .split(
          /("[^"\n]*"|\/\/[^\n]*|# [^\n]*|\b(?:import|from|func|if|nil|const|new|await|let|use|var|using|String)\b)/g,
        )
        .map((token, i) => (
          <span
            key={i}
            className={
              token.startsWith('"')
                ? "code-string"
                : /^(\/\/|# )/.test(token)
                  ? "code-comment"
                  : /^(import|from|func|if|nil|const|new|await|let|use|var|using|String)$/.test(
                        token,
                      )
                    ? "code-keyword"
                    : undefined
            }
          >
            {token}
          </span>
        ))}
    </code>
  );
}

export default function SdkShowcase() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? samples.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % samples.length
            : event.key === "ArrowLeft"
              ? (index + samples.length - 1) % samples.length
              : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }
  return (
    <div className="sdk-card">
      <div className="sdk-tabs" role="tablist" aria-label="SDK language">
        {samples.map((sample, i) => (
          <button
            key={sample.language}
            type="button"
            role="tab"
            id={`sdk-tab-${i}`}
            aria-label={sample.language}
            aria-selected={selected === i}
            aria-controls={`sdk-panel-${i}`}
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => navigate(event, i)}
            ref={(element) => {
              tabs.current[i] = element;
            }}
          >
            <DesignAsset section="36838" name={sample.icon} />
          </button>
        ))}
      </div>
      {samples.map((sample, i) => (
        <div
          key={sample.language}
          role="tabpanel"
          id={`sdk-panel-${i}`}
          aria-labelledby={`sdk-tab-${i}`}
          hidden={selected !== i}
          tabIndex={0}
        >
          <pre>
            <SyntaxCode code={sample.code} />
          </pre>
          <div className="sdk-footer">
            <span>Illustrative code</span>
            <ComingSoon>{sample.language} SDK docs ↗</ComingSoon>
          </div>
        </div>
      ))}
    </div>
  );
}
