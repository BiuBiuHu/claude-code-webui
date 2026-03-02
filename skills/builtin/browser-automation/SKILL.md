---
name: browser-automation
title: Browser Automation
description: 基于 Playwright MCP 的浏览器自动化能力，支持网页导航、截图、表单填写等操作
version: 1.0.0
author: Claude Code WebUI
tags:
  - browser
  - automation
  - testing
  - playwright
mcpServers:
  playwright:
    type: stdio
    command: npx
    args: ["@playwright/mcp@latest"]
---

# Browser Automation Skill

This skill provides browser automation capabilities using the Playwright MCP server.

## Features

- Navigate to web pages
- Take screenshots
- Fill forms
- Click elements
- Extract text and data
- Run JavaScript

## Usage

Simply say "use playwright mcp" or "open browser" in your chat to activate this skill.

## MCP Server

This skill requires the Playwright MCP server to be available:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```
