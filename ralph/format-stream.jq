# Turns `claude -p --output-format stream-json` events into a readable live log.
def short: tostring | gsub("\n"; " ") | if length > 140 then .[0:140] + "…" else . end;

if .type == "assistant" then
  (.message.content[]? |
    if .type == "text" and (.text | length) > 0 then "\n💬 " + .text + "\n"
    elif .type == "tool_use" then
      "🔧 " + .name + "  " + ((.input.command // .input.file_path // .input.pattern // .input.skill // .input.description // .input.url // "") | short) + "\n"
    else empty end)
elif .type == "user" then
  (.message.content[]? | select(.type == "tool_result" and .is_error == true) | "   ⚠️  " + (.content | short) + "\n")
elif .type == "result" then
  "\n🏁 " + (.subtype // "") + " · turns: " + ((.num_turns // 0) | tostring) + " · " + (((.duration_ms // 0) / 60000 * 10 | floor) / 10 | tostring) + " min\n"
else empty end
