# 📥 **Data Import Instructions**

## ✅ **Your Complete Production Data is Ready!**

I've successfully exported **1,072 rows** of data from your OLD Gmail Cloudflare account and created a complete SQL import file.

---

## 📊 **What's Included:**

- **6 users** (with correct password hashes)
- **15 achievements**
- **27 levels**
- **66 training materials**
- **11 tests** with 93 questions and 154 answer options
- **6 pathways** with 42 pathway-level mappings
- **2 cohort groups** with 6 members
- **17 user progress records**
- **55 test attempts** with 377 user answers
- **147 activity log entries**
- **And more!**

---

## 🚀 **How to Import:**

### **Step 1: Download the SQL File**

**Download URL:** http://localhost:3000/static/FINAL_PRODUCTION_IMPORT.sql

Or from production: https://aac9f846.training-platform-366.pages.dev/static/FINAL_PRODUCTION_IMPORT.sql

### **Step 2: Login to NEW Cloudflare Account**

1. Go to: https://dash.cloudflare.com
2. Login with: **keith.symondson@ycp.com**
3. Navigate to: **Workers & Pages → D1 → training-platform-production**
4. Click: **Console** tab

### **Step 3: Run the Import**

1. Open the downloaded `FINAL_PRODUCTION_IMPORT.sql` file in a text editor
2. **Copy ALL the content** (Ctrl+A, Ctrl+C)
3. **Paste** into the Cloudflare D1 Console
4. **Click "Execute"**

⏱️ **Estimated time:** ~30 seconds to complete

### **Step 4: Verify the Import**

After running the import, verify it worked:

```sql
SELECT COUNT(*) as count FROM users;
```

**Expected result:** 6 users

```sql
SELECT email, name, role FROM users ORDER BY id;
```

**Expected users:**
- admin@training.com (System Admin)
- boss@training.com (Jane Boss)
- consultant1@training.com (John Consultant)
- consultant2@training.com (Sarah Smith)
- consultant5@training.com (Aryna Sabalenka)
- tester@training.com (Tester)

---

## 🔐 **Test Login Credentials**

After import, you can login with:

**Admin:**
- Email: admin@training.com
- Password: admin123

**Boss:**
- Email: boss@training.com
- Password: boss123

**Consultant:**
- Email: consultant1@training.com
- Password: consultant123

---

## ⚠️ **Important Notes:**

1. **The import uses `INSERT OR IGNORE`** - it won't duplicate data if you run it twice
2. **Foreign key checks are temporarily disabled** during import for smooth execution
3. **All password hashes are preserved** from the old database
4. **The dummy admin (id=1) is automatically deleted** before import

---

## 🎯 **Next Steps After Import:**

1. ✅ **Test login** at: https://aac9f846.training-platform-366.pages.dev
2. ✅ **Verify data** - check levels, pathways, cohorts, etc.
3. ✅ **Add D1 Binding** to Cloudflare Pages (if not done yet):
   - Go to: Workers & Pages → training-platform → Settings → Functions
   - D1 database bindings → Add binding
   - Variable name: `DB`
   - D1 database: `training-platform-production`
   - Save and Redeploy

---

## 🆘 **Troubleshooting:**

**If you get an error:**
- Check that you copied the ENTIRE file (all 1,148 lines)
- Make sure you're in the correct database (training-platform-production in YCP account)
- Try splitting the import into smaller chunks (use import_part_00, import_part_01, etc.)

**If data doesn't appear after import:**
- Verify D1 binding is set up correctly in Cloudflare Pages
- Redeploy the application after adding the binding
- Clear browser cache and try logging in again

---

## ✨ **You're Almost Done!**

Once the import is complete, your NEW YCP Cloudflare account will have:
- ✅ Complete database schema (24 tables)
- ✅ All production data (1,072 rows)
- ✅ All users with correct passwords
- ✅ All pathways, levels, tests, and cohorts
- ✅ All progress tracking and achievements

🎉 **Your migration will be complete!**
