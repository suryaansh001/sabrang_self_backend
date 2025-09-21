const fs = require('fs');

// Read the file and check for basic syntax issues
try {
  const content = fs.readFileSync('index.js', 'utf8');
  
  // Count try/catch blocks
  const tries = (content.match(/try\s*{/g) || []).length;
  const catches = (content.match(/catch\s*\(/g) || []).length;
  const finallys = (content.match(/finally\s*{/g) || []).length;
  
  console.log(`Try blocks: ${tries}`);
  console.log(`Catch blocks: ${catches}`);
  console.log(`Finally blocks: ${finallys}`);
  
  // Look for unclosed try blocks
  const lines = content.split('\n');
  let tryDepth = 0;
  let inTryBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('try {')) {
      tryDepth++;
      inTryBlock = true;
      console.log(`Line ${i + 1}: Try block opened (depth: ${tryDepth})`);
    }
    
    if (line.includes('catch (') || line.includes('catch(')) {
      if (tryDepth > 0) {
        tryDepth--;
        console.log(`Line ${i + 1}: Catch block found (depth: ${tryDepth})`);
      }
    }
    
    if (line.includes('finally {')) {
      if (tryDepth > 0) {
        tryDepth--;
        console.log(`Line ${i + 1}: Finally block found (depth: ${tryDepth})`);
      }
    }
  }
  
  if (tryDepth > 0) {
    console.log(`❌ ${tryDepth} unclosed try blocks found!`);
  } else {
    console.log(`✅ All try blocks appear to be properly closed`);
  }
  
} catch (error) {
  console.error('Error checking file:', error);
}
