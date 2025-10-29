# Hotspot Question Type - Interactive Canvas Guide

## Overview

The hotspot question type now features an **interactive canvas** that allows admins to visually define answer regions by clicking directly on the diagram image. This makes it easy to create questions like the Quality Control Stage Gates diagram.

## How to Create a Hotspot Question

### Step 1: Add Hotspot Question to Test

1. Go to **Admin Dashboard** → **Levels** tab
2. Click **Manage** on any level
3. Navigate to **Tests** tab
4. Click **Add Question** for an existing test
5. Select **Question Type**: "Hotspot / Diagram Labelling"

### Step 2: Upload Your Diagram Image

1. **Paste the SharePoint URL** of your diagram image in the "Diagram Image URL" field
2. The image should be **publicly accessible** (e.g., SharePoint link with view permissions)
3. Click outside the field or press Enter to load the image

**Example URL:**
```
https://page.gensparksite.com/v1/base64_upload/1561a6c76baded8214287411ffaac1f2
```

### Step 3: Add Labels

These are the terms that students will drag onto the diagram.

1. Click **"Add Label"** to add label fields
2. Enter each label text (e.g., "Evaluation", "Aftercare", "Audit", etc.)
3. Add as many labels as needed for your diagram

**For the Stage Gates diagram, you would add:**
- Evaluation
- Aftercare  
- Audit
- Installation
- Strategic Integration (SIM)
- Diagnostics
- System
- Straight to Work
- Training
- Analysis
- Layout
- Transition
- Approach

### Step 4: Define Answer Regions (Interactive Canvas)

Once the image loads, you'll see it displayed in an interactive canvas.

**To define where each label should go:**

1. **Click on a box/region** in the diagram
2. A modal will appear asking "Which label goes here?"
3. **Select the correct label** from the dropdown
4. **Adjust the region size** if needed (width and height in pixels)
5. Click **"Add Region"**
6. A **green overlay** will appear showing the defined region
7. **Repeat** for all boxes/regions in the diagram

**Visual Feedback:**
- Defined regions show as green rectangles with the label text
- Each region displays its coordinates: `(x:25, y:520, 100×50px)`

### Step 5: Review Defined Regions

Below the canvas, you'll see a list of all defined regions:

```
✓ Defined Answer Regions

Evaluation (x:25, y:520, 100×50px)     [X]
Aftercare (x:920, y:520, 90×40px)      [X]
Audit (x:810, y:520, 50×40px)          [X]
```

- Click the **[X]** button to remove a region if you made a mistake
- The canvas updates in real-time

### Step 6: Save the Question

1. Enter **Question Text** (e.g., "Drag the labels to the correct stage gates")
2. Set **Points** (e.g., 10 points)
3. Click **"Save Question"**

## Advanced: Manual Region Entry

If you need precise control over coordinates, expand the **"Advanced: Manual Region Entry"** section:

1. Click **"Add Region Manually"**
2. Enter exact coordinates:
   - **X**: Distance from left edge (pixels)
   - **Y**: Distance from top edge (pixels)
   - **Width**: Region width (pixels)
   - **Height**: Region height (pixels)
   - **Label**: The correct label text

## Student Experience

When students take the test, they will:

1. See the blank diagram
2. See all labels as **draggable pills** below the diagram
3. **Drag each label** to the correct box
4. Drop zones are highlighted on hover
5. Submit when all labels are placed
6. **All-or-nothing grading**: All labels must be in correct regions to get points

## Tips for Best Results

### Image Guidelines
- Use **clear, high-contrast diagrams**
- Ensure text is **readable** at display size
- Test the SharePoint link is publicly accessible
- Recommended max image width: **800-1000px**

### Region Sizing
- Default region size: **100×50px** (adjustable)
- Make regions slightly **larger than the actual boxes** for easier dropping
- Leave some padding around text

### Label Names
- Keep labels **concise** (1-3 words ideal)
- Match the exact text from the answer sheet
- Use consistent capitalization

## Troubleshooting

### Image Won't Load
- ✅ Check SharePoint link has proper permissions
- ✅ Try opening the URL in a new browser tab
- ✅ Ensure URL starts with `https://`

### Can't Click on Diagram
- ✅ Make sure you've added labels first
- ✅ Check that image has finished loading
- ✅ Try refreshing the page and re-entering the URL

### Regions Not Showing
- ✅ Verify you clicked "Add Region" in the modal
- ✅ Check the "Defined Answer Regions" list below
- ✅ Make sure the image is fully visible

## Example Workflow for Stage Gates Diagram

1. **Upload Image**: Paste SharePoint link
2. **Add 13 Labels**: Evaluation, Aftercare, Audit, etc.
3. **Click on first empty box** (bottom left)
4. **Select "Evaluation"** from dropdown → Add Region
5. **Click on next box** → Select "Aftercare" → Add Region
6. **Continue** until all 13 boxes are defined
7. **Review** the green overlays match your answer sheet
8. **Save Question**

Total time: **~3-5 minutes** for a 13-region diagram!

## Technical Details

**Data Structure Saved:**
```json
{
  "imageUrl": "https://...",
  "labels": ["Evaluation", "Aftercare", "Audit", ...],
  "regions": [
    {"label": "Evaluation", "x": 25, "y": 520, "width": 100, "height": 50},
    {"label": "Aftercare", "x": 920, "y": 520, "width": 90, "height": 40},
    ...
  ]
}
```

**Grading Logic:**
- Students must place each label within its defined rectangular region
- Hit detection checks if dropped coordinates fall within `x, y, width, height` bounds
- All placements must be correct (no partial credit)

---

**Need Help?** The interactive canvas makes it easy - just click where the label should go! 🎯
