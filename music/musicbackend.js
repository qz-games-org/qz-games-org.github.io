var musicTitle;


function setup() {
    

    document.getElementById('coverpic').addEventListener("load", () => {
        console.log("Image loaded with src:", document.getElementById('coverpic').src);
        applyColoredBoxShadow(document.getElementById('coverpic'), {
            shadowSize: 3,
             blur: 6,
             segments: 8,
             edgeDepth: 5,
             useCorners: true,
             cornerRadius: 10

       });
    });

    applyColoredBoxShadow(document.getElementById('coverpic'), {
             shadowSize: 3,
             blur: 6,
             segments: 8,
             edgeDepth: 5,
             useCorners: true,
             cornerRadius: 10
        });

        createAudioVisualizer('audio');
        window.dynamicEQ.enable();


}


//styling
function getImageEdgeColorsPrecise(imgElement, options = {}) {
    // Default options
    const {
        edgeDepth = 3,           // How many pixels deep to sample from each edge
        segments = 8,            // How many segments per edge (8 = top-left, top, top-right, right, etc.)
        cornerRadius = 10,       // Radius for corner sampling
        useCorners = true,       // Whether to include corner-specific colors
        weightCenter = false     // Give more weight to center pixels of each segment
    } = options;

    // Create a canvas to analyze the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match image
    canvas.width = imgElement.naturalWidth || imgElement.width;
    canvas.height = imgElement.naturalHeight || imgElement.height;
    
    // Draw the image on canvas
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const w = canvas.width;
    const h = canvas.height;
    
    // Helper function to get weighted average color from pixel array
    function getAverageColor(pixels, weights = null) {
        if (pixels.length === 0) return [0, 0, 0];
        
        let r = 0, g = 0, b = 0, totalWeight = 0;
        const pixelCount = pixels.length / 4;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const weight = weights ? weights[Math.floor(i / 4)] : 1;
            r += pixels[i] * weight;
            g += pixels[i + 1] * weight;
            b += pixels[i + 2] * weight;
            totalWeight += weight;
        }
        
        return [
            Math.round(r / totalWeight),
            Math.round(g / totalWeight),
            Math.round(b / totalWeight)
        ];
    }
    
    // Helper function to get pixel at coordinate
    function getPixel(x, y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return [0, 0, 0, 0];
        const i = (y * w + x) * 4;
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    }
    
    // Helper function to sample a line of pixels with depth
    function sampleLine(startX, startY, endX, endY, depth) {
        const pixels = [];
        const weights = [];
        const length = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
        
        for (let i = 0; i <= length; i++) {
            const t = length === 0 ? 0 : i / length;
            const baseX = Math.round(startX + (endX - startX) * t);
            const baseY = Math.round(startY + (endY - startY) * t);
            
            // Sample multiple pixels at different depths
            for (let d = 0; d < depth; d++) {
                let sampleX = baseX;
                let sampleY = baseY;
                
                // Adjust sampling position based on edge direction
                if (startY === endY) { // Horizontal line
                    sampleY = startY === 0 ? d : startY - d; // Top or bottom edge
                } else if (startX === endX) { // Vertical line  
                    sampleX = startX === 0 ? d : startX - d; // Left or right edge
                }
                
                const pixel = getPixel(sampleX, sampleY);
                pixels.push(...pixel);
                
                // Weight pixels closer to edge more heavily
                const weight = weightCenter ? 
                    (depth - d) * (1 + Math.sin(Math.PI * t)) : // Center-weighted
                    (depth - d); // Edge-weighted
                weights.push(weight);
            }
        }
        
        return { pixels, weights };
    }
    
    // Helper function to sample corner area
    function sampleCorner(centerX, centerY, radius) {
        const pixels = [];
        const weights = [];
        
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius) {
                    const pixel = getPixel(centerX + dx, centerY + dy);
                    pixels.push(...pixel);
                    
                    // Weight pixels closer to corner center more heavily
                    const weight = (radius - distance + 1) / radius;
                    weights.push(weight);
                }
            }
        }
        
        return { pixels, weights };
    }
    
    const results = {};
    
    if (segments === 4) {
        // Simple 4-direction sampling
        const topSample = sampleLine(0, 0, w - 1, 0, edgeDepth);
        const rightSample = sampleLine(w - 1, 0, w - 1, h - 1, edgeDepth);
        const bottomSample = sampleLine(w - 1, h - 1, 0, h - 1, edgeDepth);
        const leftSample = sampleLine(0, h - 1, 0, 0, edgeDepth);
        
        results.top = getAverageColor(topSample.pixels, topSample.weights);
        results.right = getAverageColor(rightSample.pixels, rightSample.weights);
        results.bottom = getAverageColor(bottomSample.pixels, bottomSample.weights);
        results.left = getAverageColor(leftSample.pixels, leftSample.weights);
        
    } else if (segments === 8) {
        // 8-direction sampling with corners
        const segmentSize = Math.floor(Math.min(w, h) / 4);
        
        // Top edge segments
        const topLeft = sampleLine(0, 0, segmentSize, 0, edgeDepth);
        const topCenter = sampleLine(segmentSize, 0, w - segmentSize, 0, edgeDepth);
        const topRight = sampleLine(w - segmentSize, 0, w - 1, 0, edgeDepth);
        
        // Right edge segments  
        const rightTop = sampleLine(w - 1, 0, w - 1, segmentSize, edgeDepth);
        const rightCenter = sampleLine(w - 1, segmentSize, w - 1, h - segmentSize, edgeDepth);
        const rightBottom = sampleLine(w - 1, h - segmentSize, w - 1, h - 1, edgeDepth);
        
        // Bottom edge segments
        const bottomRight = sampleLine(w - 1, h - 1, w - segmentSize, h - 1, edgeDepth);
        const bottomCenter = sampleLine(w - segmentSize, h - 1, segmentSize, h - 1, edgeDepth);
        const bottomLeft = sampleLine(segmentSize, h - 1, 0, h - 1, edgeDepth);
        
        // Left edge segments
        const leftBottom = sampleLine(0, h - 1, 0, h - segmentSize, edgeDepth);
        const leftCenter = sampleLine(0, h - segmentSize, 0, segmentSize, edgeDepth);
        const leftTop = sampleLine(0, segmentSize, 0, 0, edgeDepth);
        
        results.topLeft = getAverageColor(topLeft.pixels, topLeft.weights);
        results.top = getAverageColor(topCenter.pixels, topCenter.weights);
        results.topRight = getAverageColor(topRight.pixels, topRight.weights);
        results.right = getAverageColor(rightCenter.pixels, rightCenter.weights);
        results.bottomRight = getAverageColor(bottomRight.pixels, bottomRight.weights);
        results.bottom = getAverageColor(bottomCenter.pixels, bottomCenter.weights);
        results.bottomLeft = getAverageColor(bottomLeft.pixels, bottomLeft.weights);
        results.left = getAverageColor(leftCenter.pixels, leftCenter.weights);
        
        // Add corner-specific sampling if enabled
        if (useCorners) {
            const tlCorner = sampleCorner(cornerRadius, cornerRadius, cornerRadius);
            const trCorner = sampleCorner(w - 1 - cornerRadius, cornerRadius, cornerRadius);
            const brCorner = sampleCorner(w - 1 - cornerRadius, h - 1 - cornerRadius, cornerRadius);
            const blCorner = sampleCorner(cornerRadius, h - 1 - cornerRadius, cornerRadius);
            
            results.cornerTopLeft = getAverageColor(tlCorner.pixels, tlCorner.weights);
            results.cornerTopRight = getAverageColor(trCorner.pixels, trCorner.weights);
            results.cornerBottomRight = getAverageColor(brCorner.pixels, brCorner.weights);
            results.cornerBottomLeft = getAverageColor(blCorner.pixels, blCorner.weights);
        }
    }
    
    // Convert to RGB strings
    const rgbResults = {};
    for (const [key, color] of Object.entries(results)) {
        rgbResults[key] = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    }
    
    return rgbResults;
}

function applyColoredBoxShadow(imgElement, options = {}) {
    const {
        shadowSize = 10,
        blur = 15,
        segments = 8,
        edgeDepth = 3,
        useCorners = true,
        cornerRadius = 10,
        opacity = 0.6
    } = options;
    
    // Make sure image is loaded
    if (!imgElement.complete) {
        imgElement.onload = () => applyPreciseColoredBoxShadow(imgElement, options);
        return;
    }
    
    try {
        const colors = getImageEdgeColorsPrecise(imgElement, {
            segments,
            edgeDepth,
            useCorners,
            cornerRadius,
            weightCenter: true
        });
        
        const shadows = [];
        
        if (segments === 4) {
            // Simple 4-direction shadows
            shadows.push(`0 -${shadowSize}px ${blur}px ${colors.top.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`);
            shadows.push(`${shadowSize}px 0 ${blur}px ${colors.right.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`);
            shadows.push(`0 ${shadowSize}px ${blur}px ${colors.bottom.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`);
            shadows.push(`-${shadowSize}px 0 ${blur}px ${colors.left.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`);
            
        } else if (segments === 8) {
            // 8-direction shadows with varied positioning
            const smallOffset = Math.floor(shadowSize * 0.7);
            const largeOffset = shadowSize;
            
            // Diagonal corners
            shadows.push(`-${smallOffset}px -${smallOffset}px ${blur}px ${colors.topLeft?.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.8})`)}`);
            shadows.push(`${smallOffset}px -${smallOffset}px ${blur}px ${colors.topRight?.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.8})`)}`);
            shadows.push(`${smallOffset}px ${smallOffset}px ${blur}px ${colors.bottomRight?.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.8})`)}`);
            shadows.push(`-${smallOffset}px ${smallOffset}px ${blur}px ${colors.bottomLeft?.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.8})`)}`);
            
            // Cardinal directions  
            shadows.push(`0 -${largeOffset}px ${blur}px ${colors.top?.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`);
            shadows.push(`${largeOffset}px 0 ${blur}px ${colors.right?.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`);
            shadows.push(`0 ${largeOffset}px ${blur}px ${colors.bottom?.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`);
            shadows.push(`-${largeOffset}px 0 ${blur}px ${colors.left?.replace('rgb', 'rgba').replace(')', `, ${opacity})`)}`);
            
            // Corner-specific shadows if available
            if (useCorners && colors.cornerTopLeft) {
                const cornerOffset = Math.floor(shadowSize * 1.5);
                shadows.push(`-${cornerOffset}px -${cornerOffset}px ${blur * 1.5}px ${colors.cornerTopLeft.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.4})`)}`);
                shadows.push(`${cornerOffset}px -${cornerOffset}px ${blur * 1.5}px ${colors.cornerTopRight.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.4})`)}`);
                shadows.push(`${cornerOffset}px ${cornerOffset}px ${blur * 1.5}px ${colors.cornerBottomRight.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.4})`)}`);
                shadows.push(`-${cornerOffset}px ${cornerOffset}px ${blur * 1.5}px ${colors.cornerBottomLeft.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.4})`)}`);
            }
        }
        
        // Apply the box shadow
        imgElement.style.boxShadow = shadows.join(', ');
        
        return colors;
        
    } catch (error) {
        console.error('Error applying precise colored box shadow:', error);
        console.error('Make sure the image is from the same origin or has CORS headers');
    }
}

// Usage examples:

// Apply to a single image
// const img = document.querySelector('#myImage');
// applyColoredBoxShadow(img);

// Apply to all images on page
// document.querySelectorAll('img').forEach(img => {
//     applyColoredBoxShadow(img, 15, 20); // shadowSize: 15px, blur: 20px
// });

// Apply with custom settings
// applyColoredBoxShadow(imgElement, 20, 25); // larger shadow and blur

// Get colors without applying shadow
// const colors = getImageEdgeColors(imgElement);
// console.log(colors); // {top: "rgb(255,0,0)", right: "rgb(0,255,0)", ...}


//load

function loadsongs() {
    loadFromURL('../music/music.json');
}

// Function to create a music item element
function createMusicItem(key, data) {
    const item = document.createElement('div');
    item.className = 'music-item';
    item.setAttribute('quick-addd',  `player.addSongToQueue('${data.name}', '${data.artist}',  '${data.ft}',  '${data.cover}', '../music/assets/music/' + '${data.file}');`)
    
    // Build the artist line (artist + ft on the bottom line)
    const artistLine = data.ft ? `${data.artist}, ft. ${data.ft}` : data.artist;

    item.innerHTML = `
      <div class="music-cover">
        ${data.cover
          ? `<img src="${'./music/assets/covers/' + data.cover}" alt="${data.name} cover"
                  onerror="this.parentElement.textContent='No Image'">`
          : `No Image`}
        <button class="row-play" aria-label="Play ${data.name}">
          <span class="material-icons">play_arrow</span>
        </button>
      </div>
    
      <div class="music-meta">
        <div class="music-title">${data.name}</div>
        <div class="music-artist">${artistLine}</div>
      </div>
    
      <div class="music-album">${data.album ?? ''}</div>
    
      <div class="music-right">
       
      </div>
    `;
    
    
    // Add click event to call play function with parameters
    item.addEventListener('click', () => {
        starteq()

        player.play(data.name, data.artist, data.ft, data.cover, '../music/assets/music/' + data.file);
    });
    
    return item;
}

// Function to load music data into the container
function loadMusicData(musicData) {
    const container = document.getElementById('music-container');
    container.innerHTML = ''; // Clear existing content
    
    if (!musicData || Object.keys(musicData).length === 0) {
        container.innerHTML = '<div class="loading">No music data found</div>';
        return;
    }
    
    // Create and append music items
    Object.entries(musicData).forEach(([key, data]) => {
        const musicItem = createMusicItem(key, data);
        container.appendChild(musicItem);
    });
}

function loadFromURL(url) {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            loadMusicData(data);
        })
        .catch(error => {
            console.error('Error loading JSON:', error);
            document.getElementById('music-container').innerHTML = '<div class="loading">Error loading music data</div>';
        });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('start setup')
    setup()
    loadsongs()
});



const css = `
  .music-ctx {position:absolute;min-width:220px;background:rgba(25,25,25,.98);color:#eee;
    border:1px solid rgba(255,255,255,.08);border-radius:12px;box-shadow:0 10px 28px rgba(0,0,0,.4);
    padding:6px;z-index:9999;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none}
  .music-ctx-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border:0;background:transparent;
    color:inherit;font:inherit;text-align:left;border-radius:10px;cursor:pointer;user-select:none;width:100%}
  .music-ctx-item:hover:not([disabled]){background:rgba(255,255,255,.08)}
  .music-ctx-item[disabled]{opacity:.45;cursor:not-allowed}
  .music-ctx-sep{height:1px;background:rgba(255,255,255,.08);margin:6px 4px;border-radius:1px}
  .music-ctx-item .material-icons{font-size:20px;line-height:0;opacity:.9}
`;
const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

// Build menu once
const menu = document.createElement('div');
menu.className = 'music-ctx';
menu.innerHTML = `
  <button class="music-ctx-item">
    <span class="material-icons">playlist_add</span><span>Add to playlist</span>
  </button>
  <button class="music-ctx-item" disabled>
    <span class="material-icons">person</span><span>Go to artist</span>
  </button>
  <div class="music-ctx-sep" aria-hidden="true"></div>
  <button class="music-ctx-item" data-action="add-to-queue">
    <span class="material-icons">queue_music</span><span>Add to queue</span>
  </button>
`;
document.body.appendChild(menu);

let currentItem = null;

const showMenu = (x, y) => {
  menu.style.display = 'block';
  // keep on-screen
  const r = menu.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = x, top = y;
  if (left + r.width > vw - 8) left = vw - r.width - 8;
  if (top + r.height > vh - 8) top = vh - r.height - 8;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  menu.style.left = `${left + window.scrollX}px`;
  menu.style.top = `${top + window.scrollY}px`;
};
const hideMenu = () => { menu.style.display = 'none'; };

// Open on right-click over .music-item
document.addEventListener('contextmenu', (e) => {
  const item = e.target.closest('.music-item');
  if (!item) { hideMenu(); return; }
  e.preventDefault();
  currentItem = item;
  showMenu(e.clientX, e.clientY);
});

// Handle clicks on menu
menu.addEventListener('click', (e) => {
  const btn = e.target.closest('.music-ctx-item');
  if (!btn || btn.disabled) return;

  const action = btn.getAttribute('data-action');
  if (action === 'add-to-queue' && currentItem) {
    const code = currentItem.getAttribute('quick-addd') || currentItem.dataset.quickAddd;
    if (!code) {
      console.warn('[ContextMenu] quick-addd attribute missing on element:', currentItem);
    } else {
      try {
        // Provide a 'player' param so code like "player.play(...)" works,
        // defaulting to window.musicPlayer or window.player
        const playerRef = window.musicPlayer || window.player;
        const run = new Function('player', code);
        run(playerRef);
      } catch (err) {
        console.error('[ContextMenu] Failed to execute quick-addd:', err);
      }
    }
    hideMenu();
  }
});

// Dismiss on outside interactions
document.addEventListener('mousedown', (e) => { if (!menu.contains(e.target)) hideMenu(); });
window.addEventListener('scroll', hideMenu, { passive: true });
window.addEventListener('resize', hideMenu);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(); });

// Prevent native menu on our custom menu
menu.addEventListener('contextmenu', (e) => e.preventDefault());

console.log('[ContextMenu] Ready. Right-click any .music-item');