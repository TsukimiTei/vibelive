#!/bin/bash
API_KEY="AIzaSyBTF_LBbi7BJObx96V1EobmYQY9LT11cB8"
MODEL="gemini-2.5-flash-image"
URL="https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}"
OUT_DIR="app/public/images/logo-drafts"

generate_logo() {
  local idx=$1
  local prompt=$2
  local outfile="${OUT_DIR}/logo_v${idx}.png"

  local payload=$(cat <<EOJSON
{
  "contents": [{
    "parts": [{
      "text": "$prompt"
    }]
  }],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"]
  }
}
EOJSON
)

  local response=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "$payload")

  # Extract base64 image data from response
  local img_data=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    parts = data['candidates'][0]['content']['parts']
    for p in parts:
        if 'inlineData' in p:
            print(p['inlineData']['data'])
            break
except Exception as e:
    print('ERROR:' + str(e), file=sys.stderr)
")

  if [ -n "$img_data" ] && [[ "$img_data" != ERROR* ]]; then
    echo "$img_data" | base64 -d > "$outfile"
    echo "✓ Logo v${idx} saved to ${outfile}"
  else
    echo "✗ Logo v${idx} generation failed"
    echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'error' in data:
        print('  Error:', data['error'].get('message','unknown'))
    else:
        parts = data.get('candidates',[{}])[0].get('content',{}).get('parts',[])
        for p in parts:
            if 'text' in p:
                print('  Response:', p['text'][:200])
except:
    pass
" 2>/dev/null
  fi
}

# 5 different creative directions
PROMPTS=(
  "Design a logo icon for 'VibeLive', a live coding streaming platform. Style: pixel art / retro 8-bit game aesthetic. Use cyan and purple neon glow colors on a dark background. The icon should feature a pixelated play button merged with a code bracket symbol. Clean, simple, iconic, suitable as a favicon and app icon. Square format, no text, just the icon mark."

  "Design a logo icon for 'VibeLive', a live coding streaming platform. Style: cyberpunk neon sign. A glowing letter V shape formed by circuit board traces and code symbols, emitting cyan and green neon light. Dark background, sharp edges, futuristic tech feel. Square format, no text besides the V shape, just the icon mark. Clean and bold."

  "Design a logo icon for 'VibeLive', a live coding streaming platform. Style: minimalist geometric. A stylized eye or lens shape combined with a code cursor blinking indicator, representing 'watching code being written live'. Colors: electric cyan on deep dark blue. Modern, clean, flat design. Square format, no text, just the icon mark."

  "Design a logo icon for 'VibeLive', a live coding streaming platform. Style: abstract energy wave. A dynamic waveform or pulse signal that morphs into angle brackets < >, representing both live broadcasting and code. Gradient from purple to cyan to green. Dark background. Square format, no text, just the icon mark. Energetic and modern."

  "Design a logo icon for 'VibeLive', a live coding streaming platform. Style: bold symbol. A diamond or crystal shape containing a streaming/broadcast signal icon, with subtle pixel grid texture overlay. Colors: bright green glow with purple accents on dark background. Gaming meets tech aesthetic. Square format, no text, just the icon mark."
)

echo "Generating 5 logo concepts for VibeLive..."
echo ""

for i in {0..4}; do
  idx=$((i + 1))
  generate_logo "$idx" "${PROMPTS[$i]}" &
done

wait
echo ""
echo "Done! Check ${OUT_DIR}/"
