import type { ReactNode } from "react";

export interface TerminalCommand {
  /** Shell-style command echoed after the prompt. */
  command: string;
  /** Output lines printed under the command. */
  output: string[];
}

interface TerminalBlockProps {
  /** Filename-style label in the top-left notch, e.g. "SEASON_DETAILS.CFG". */
  title: string;
  commands: TerminalCommand[];
  /** Renders a blinking cursor after the final output line. */
  cursor?: boolean;
  /** Preserve the source casing of output lines instead of the default uppercase. */
  preserveCase?: boolean;
  children?: ReactNode;
}

const PROMPT = "league@10for10x:~$";

export function TerminalBlock({
  title,
  commands,
  cursor = true,
  preserveCase = false,
  children,
}: TerminalBlockProps) {
  const lastCommand = commands.length - 1;

  return (
    <div className="terminal-section">
      <div className="terminal-header">{title}</div>
      {commands.map((entry, commandIndex) => (
        // Index-based key: output lines may repeat verbatim (e.g. a URL cited in two
        // sections), so content can't be relied on as a unique React key here.
        <div key={`${commandIndex}-${entry.command}`}>
          <div className="terminal-row">
            <span className="prompt">{PROMPT}</span>
            <span className="command">{entry.command}</span>
          </div>
          {entry.output.map((line, lineIndex) => {
            const isLast = commandIndex === lastCommand && lineIndex === entry.output.length - 1;
            return (
              <div className="terminal-row" key={`${commandIndex}-${lineIndex}`}>
                <span className={preserveCase ? "output output--case" : "output"}>
                  {`> ${line}`}
                  {cursor && isLast ? <span className="cursor-blink">_</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      {children}
    </div>
  );
}
