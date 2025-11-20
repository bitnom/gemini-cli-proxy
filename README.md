## Gemini CodeAssist Proxy 

This local server provides OpenAI (`/openai`) and Anthropic (`/anthropic`) compatible endpoints through Gemini CodeAssist (Gemini CLI).

* If you have used Gemini CLI before, it will utilize existing Gemini CLI credentials.
* If you have NOT used Gemini CLI before, you will be prompted to log in to Gemini CLI App through browser. 

### But why?

Gemini CodeAssist (Gemini CLI) offers a generous free tier. As of [2025-09-01](https://codeassist.google/), the free tier offers 60 requests/min and 
1,000 requests/day. 

Gemini CodeAssist does not provide direct access to Gemini models which limits your choice to ~~[highly rated CodeAssist plugins](https://plugins.jetbrains.com/plugin/24198-gemini-code-assist)~~

## Quick Start
 
```npx gemini-cli-proxy``` 

The server will start on `http://localhost:3000`
* OpenAI compatible endpoint: `http://localhost:3000/openai`
* Anthropic compatible endpoint: `http://localhost:3000/anthropic`

### Usage

```bash
npx gemini-cli-proxy [options]
```

Options:
- `-p, --port <port>` - Server port (default: 3000) 
- `-g, --google-cloud-project <project>` - Google Cloud project ID if you have paid/enterprise tier (default: GOOGLE_CLOUD_PROJECT env variable)
- `--disable-browser-auth` - Disables browser auth flow and uses code based auth (default: false)
- `--disable-google-search` - Disables native Google Search tool (default: false)
- `--disable-auto-model-switch` - Disables auto model switching in case of rate limiting (default: false)

If you have NOT used Gemini CLI before, you will be prompted to log in to Gemini CLI App through browser. Credentials will be saved in the folder (`~/.gemini/oauth_creds.json`) used by Gemini CLI.

`gemini-3-pro-preview` is the default model when you request a model other than `gemini-3-pro-preview` or `gemini-2.5-flash`

### Use with -insert-your-favorite-agentic-tool-here-

Most agentic tools rely on environment variables, you can export the following variables

```
export OPENAI_API_BASE=http://localhost:3000/openai
export OPENAI_API_KEY=ItDoesNotMatter
export ANTHROPIC_BASE_URL="http://localhost:3000/anthropic"
export ANTHROPIC_AUTH_TOKEN=ItDoesNotMatter
```

### Use with Claude Code

Add the following env fields to `.claude/settings.json` file

```json
{
  "permissions": {
    ...
  },
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3000/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "NotImportant",
    "ANTHROPIC_MODEL": "gemini-3-pro-preview"
  }
}
```

### Use with Zed

Add the following to the Zed config file
```json
{
  "language_models": {
    "openai": {
      "api_url": "http://localhost:3000/openai",
      "available_models": [
        {
          "name": "gemini-2.5",
          "display_name": "localhost:gemini-2.5",
          "max_tokens": 131072
        }
      ]
    }
  }
}
```

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript  
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── auth/           # Google authentication logic
├── gemini/         # Gemini API client and mapping
├── routes/         # Express route handlers
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```
