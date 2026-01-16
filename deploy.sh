#!/bin/bash
# YCP Cloudflare Account Deployment Script
# Account: Keith.symondson@ycp.com

# Set credentials
export CLOUDFLARE_API_TOKEN="lPTMqgxiNT2hSp_8o8sBJjZhK2UyIOKYih606Iql"
export CLOUDFLARE_ACCOUNT_ID="d051fdf708da167d1668ff4c62f0cb14"

# Build and deploy
cd /home/user/webapp
npm run build
npx wrangler pages deploy dist --project-name training-platform --commit-dirty=true
