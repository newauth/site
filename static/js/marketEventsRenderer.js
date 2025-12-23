(function() {
	
function alphabetLocation(char) {
  const code = char.toUpperCase().charCodeAt(0);
  if (code >= 65 && code <= 90) {
    return Math.ceil((code - 64)/9); 
  }
  return null;
}

function injectPriceMovesStyles() {
  if (document.getElementById('price-moves-style')) return;

  const style = document.createElement('style');
  style.id = 'price-moves-style';
  style.textContent = `
  .price-moves-container {
    display: flex;
    height: 100px;
    width: 75%;
    margin: 0 auto;
    background-color: #fff;
    border: 1px solid #ccc;
    overflow-x: auto;
    overflow-y: visible;
    position: relative;
    scroll-behavior: smooth;
	z-index:1;
    /* Discrete/minimal scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: #ccc transparent;
  }
  .price-moves-container::-webkit-scrollbar {
    height: 6px;
  }
  .price-moves-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .price-moves-container::-webkit-scrollbar-thumb {
    background-color: #ccc;
    border-radius: 3px;
  }
  .price-moves-container::-webkit-scrollbar-thumb:hover {
    background-color: #999;
  }
    .center-line {
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 1px;
      background-color: #ccc;
      z-index: 0;
    }
    .date-column {
      position: relative;
      width: 60px;
      height: 100px;
      flex-shrink: 0;
      z-index: 1;
    }
    .date-label {
      position: absolute;
      top: 2px;
      left: 35%;
      transform: translateX(-50%);
      font-size: 10px;
      color: #555;
      background: #fff;
      padding: 2px 4px;
      border-radius: 4px;
      z-index: 1;
    }
    .evt-dot {
      position: absolute;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.2s ease;
      z-index: 1;
    }
    .price-tooltip {
      position: fixed;
      background: #333;
      color: #fff;
      padding: 4px 8px;
      font-size: 12px;
      white-space: nowrap;
      border-radius: 4px;
      pointer-events: none;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .price-tooltip.visible {
      opacity: 1;
    }
	.friday-column {
	  position: relative;
	}

	.friday-column::after {
	  content: '';
	  position: absolute;
	  top: 20%;              /* skip top 20% */
	  bottom: 20%;           /* skip bottom 20% */
	  right: 0;
	  width: 2px;
	  background-color: #aaa; /* or any color you like */
	}
  `;
  document.head.appendChild(style);
}

// Create tooltip element
let tooltipEl = null;
function getTooltipElement() {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'price-tooltip';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(event, text) {
  const tooltip = getTooltipElement();
  tooltip.textContent = text;
  tooltip.classList.add('visible');
  
  const dot = event.currentTarget;
  const rect = dot.getBoundingClientRect();
  
  // Position tooltip above the dot, centered
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  let top = rect.top - tooltipRect.height - 8;
  
  // Prevent tooltip from going off-screen left
  if (left < 5) {
    left = 5;
  }
  
  // Prevent tooltip from going off-screen right
  if (left + tooltipRect.width > window.innerWidth - 5) {
    left = window.innerWidth - tooltipRect.width - 5;
  }
  
  // If tooltip would go above viewport, show it below instead
  if (top < 5) {
    top = rect.bottom + 8;
  }
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  
  const dotColor = window.getComputedStyle(dot).backgroundColor;
  tooltip.style.backgroundColor = dotColor;
}

function hideTooltip() {
  const tooltip = getTooltipElement();
  tooltip.classList.remove('visible');
}

function renderPriceMoves(data, containerId) {
	
  injectPriceMovesStyles();

  const container = document.getElementById(containerId);
  if (!container) return;
  
 

  container.innerHTML = '';
  container.className = 'price-moves-container';
  container.style.zIndex = 1;
  container.style.position = 'relative';

  const height = container.offsetHeight || 100;

  const centerLine = document.createElement('div');
  centerLine.className = 'center-line';
  container.appendChild(centerLine);

  const grouped = groupByDate(data);

  Object.entries(grouped).forEach(([date, items]) => {
    const column = document.createElement('div');
    column.className = 'date-column';

    const label = document.createElement('div');
    label.className = 'date-label';
	const [year, month, day] = date.split('-');
	const dateObj = new Date(year, month - 1, day); // month is 0-indexed
	
	const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 5 = Friday

	//console.log('dayOfWeek ' + dayOfWeek);
	if (dayOfWeek === 5) {
	  column.classList.add('friday-column');
	}
	
	label.textContent = dateObj.toLocaleDateString('en-US', {
	  month: 'short',
	  day: '2-digit'
	});
    column.appendChild(label);

    const upMoves = items.filter(i => i.change > 0);
    const downMoves = items.filter(i => i.change < 0);
    const leftPositions = ['10%', '30%', '50%', '70%', '80%'];

    upMoves.forEach((item, i) => {
      const dot = createDot(item, height);
      dot.style.left = leftPositions[i % 5];
      column.appendChild(dot);
    });

    downMoves.forEach((item, i) => {
      const dot = createDot(item, height);
      dot.style.left = leftPositions[i % 5];
      column.appendChild(dot);
    });

    container.appendChild(column);
  });

  // Scroll to show the most recent dates (rightmost)
  setTimeout(() => {
    container.scrollLeft = container.scrollWidth - container.clientWidth;
  }, 0);
  
  // ADD hover logic to container
   let hoverTimer = null;
     let resetTimer = null;

     container.style.transition = 'box-shadow 0.2s ease, z-index 0.2s ease';

     container.addEventListener('mouseenter', () => {
       clearTimeout(resetTimer);
       hoverTimer = setTimeout(() => {
         container.style.zIndex = '999';
		 container.style.boxShadow = '0 8px 16px rgba(0,0,0,0.35)'
       }, 300); // 1 second delay
     });

     container.addEventListener('mouseleave', () => {
       clearTimeout(hoverTimer);
       resetTimer = setTimeout(() => {
         container.style.zIndex = '1';
         container.style.boxShadow = 'none';
       }, 600); // fade out delay
     });

	 
	 setTimeout(() => {
	     toggleDelayedMouseover(true);
	   }, 2500);
}

function groupByDate(data) {
  return data.reduce((acc, item) => {
    acc[item.dateString] = acc[item.dateString] || [];
    acc[item.dateString].push(item);
    return acc;
  }, {});
}

const pastelPalette = [
  "#c62828", "#e65100", "#f9a825", "#388e3c", "#1976d2",
  "#512da8", "#c2185b", "#00838f", "#7b1fa2"
];

function getColorForNumber(num) {
  const validKeys = [11,12,13,21,22,23,31,32,33];
  const index = validKeys.indexOf(num);
  return index !== -1 ? pastelPalette[index] : null;
}

function createDot(item, height) {
  const dot = document.createElement('div');
  dot.className = 'evt-dot ' + (item.change >= 0 ? 'up' : 'down');
  
  // Add exclamation for extreme moves in tooltip
  const isExtreme = Math.abs(item.change) >= 100;
  const tooltipText = `${item.ticker}: ${item.price.toFixed(0)} (${item.change.toFixed(0)}%${isExtreme ? '!' : ''})`;
  
  // Add event listeners for tooltip
  let longHoverTimer = null;
  let similardotsmaskapplied = false;
  dot.addEventListener('mouseenter', (e) => {
    showTooltip(e, tooltipText); // immediate tooltip

    longHoverTimer = setTimeout(() => {
      masksimilardots(item.ticker, true); 
	  similardotsmaskapplied= true;
    }, 1000); // 2 seconds
  });

  dot.addEventListener('mouseleave', () => {
    hideTooltip();
	if (similardotsmaskapplied) {
		masksimilardots(item.ticker, false); 
		similardotsmaskapplied = false;
	}
    clearTimeout(longHoverTimer); // cancel if hover ends early
  });

  let size = 2;
  if (item.price >= 50 && item.price < 300) size = 5;
  else if (item.price >= 300 && item.price < 500) size = 8;
  else if (item.price >= 500) size = 11;

  dot.style.width = `${size}px`;
  dot.style.height = `${size}px`;

  // Account for dot size and add padding
  const halfSize = size / 2;
  const maxOffset = height / 2 - halfSize - 2;
  
  // Cap display at 100% - anything beyond shows at max position
  const displayChange = Math.max(-100, Math.min(100, item.change));
  const offset = Math.min(Math.abs(displayChange) * (maxOffset / 50), maxOffset);
  
  const y = item.change > 0
    ? height / 2 - offset
    : height / 2 + offset;

  dot.style.top = `${y}px`;
  dot.style.transform = `translateX(-50%)`;
  dot.setAttribute('data-ticker' , item.ticker);

  const firstChar = alphabetLocation(item.ticker.charAt(0));
  const secondChar = alphabetLocation(item.ticker.charAt(1));
  dot.style.backgroundColor = getColorForNumber(parseInt(firstChar)*10 + parseInt(secondChar));

  return dot;
}

function addAccordionToggleRight(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  

  if (!document.getElementById('accordion-toggle-style')) {
    const style = document.createElement('style');
    style.id = 'accordion-toggle-style';
    style.textContent = `
      .accordion-wrapper {
        position: relative;
        transition: transform 0.4s ease, opacity 0.4s ease;
      }
      .accordion-collapsed {
        transform: translateX(-100%);
        opacity: 0;
        pointer-events: none;
      }
      .accordion-expand-btn {
        position: fixed;
        left: 0;
        transform: translateY(-50%);
        background: #eee;
        border: 1px solid #ccc;
        border-left: none;
        border-radius: 0 4px 4px 0;
        padding: 3px 5px;
        cursor: pointer;
        font-size: 16px;
        z-index: 1000;
        display: none;
      }
      .accordion-collapse-btn {
        position: absolute;
        top: 50%;
        right: 12.5%;
        transform: translateY(-50%);
        background: #eee;
        border: 1px solid #ccc;
        border-right: none;
        border-radius: 4px 0 0 4px;
        padding: 3px 5px;
        cursor: pointer;
        font-size: 16px;
        z-index: 10;
      }
	  .accordion-color-toggle {
		position: absolute;
        top:10%;
        right: 13%;
        transform: translateY(-50%);
	    z-index: 999;
	    display: flex;
	    align-items: center;
	    gap: 8px;
	    font-size: 14px;
	    font-family: sans-serif;
	    cursor: pointer;
	    user-select: none;
	  }

	  .toggle-switch {
	    position: relative;
	    width: 20px;
	    height: 10px;
	    background: #ccc;
	    border-radius: 5px;
	    transition: background 0.3s ease;
	  }

	  .toggle-switch::before {
	    content: '';
	    position: absolute;
	    top: 1px;
	    left: 1px;
	    width: 8px;
	    height: 8px;
	    background: #fff;
	    border-radius: 50%;
	    transition: transform 0.3s ease;
	  }

	  .toggle-switch.active {
	    background: #4caf50;
	  }

	  .toggle-switch.active::before {
	    transform: translateX(10px);
	  }


    `;
    document.head.appendChild(style);
  }

  wrapper.classList.add('accordion-wrapper');

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'accordion-collapse-btn';
  collapseBtn.textContent = '<';

  const expandBtn = document.createElement('button');
  expandBtn.className = 'accordion-expand-btn';
  expandBtn.textContent = '>';
  expandBtn.style.display = 'none';

  collapseBtn.onclick = () => {
    // Calculate the wrapper's center position before collapsing
    const rect = wrapper.getBoundingClientRect();
    const centerY = rect.top + (rect.height / 2);
    
    wrapper.classList.add('accordion-collapsed');
    collapseBtn.style.display = 'none';
    expandBtn.style.display = 'block';
    expandBtn.style.top = `${centerY}px`;
  };

  expandBtn.onclick = () => {
    wrapper.classList.remove('accordion-collapsed');
    expandBtn.style.display = 'none';
    collapseBtn.style.display = 'block';
  };
  
  const colorToggleWrapper = document.createElement('div');
  colorToggleWrapper.className = 'accordion-color-toggle';

  const colorLabel = document.createElement('span');
  colorLabel.textContent = 'Use Event Color';
  colorLabel.style.color = '#888';
  colorLabel.style.fontSize = '11px';

  const toggleSwitch = document.createElement('div');
  toggleSwitch.className = 'toggle-switch';

  colorToggleWrapper.appendChild(colorLabel);
  colorToggleWrapper.appendChild(toggleSwitch);
  wrapper.appendChild(colorToggleWrapper);
  
 

  toggleSwitch.onclick = (event) => {
    event.stopPropagation(); 
	
	if (colorMode == '') colorMode = 'uniform';

    colorMode = colorMode === 'event' ? 'uniform' : 'event';
    toggleSwitch.classList.toggle('active', colorMode === 'event');

    if (colorMode === 'event') {
      applyEventColors();
    } else {
      applyUniformColor();
    }
  };

  wrapper.appendChild(collapseBtn);
  document.body.appendChild(expandBtn);
  
}
function masksimilardots(ticker, apply) {
	document.querySelectorAll('.dot').forEach(dot => {
		
	    const tickerfirstChar = alphabetLocation(ticker.charAt(0) || '');
	    const tickersecondChar = alphabetLocation(ticker.charAt(1) || '');
		
		const firstChar = alphabetLocation(dot.textContent.charAt(0) || '');
		const secondChar = alphabetLocation(dot.textContent.charAt(1) || '');
				
	    if (tickerfirstChar == firstChar && tickersecondChar == secondChar) {
			if (apply)
				dot.style.display = 'block';
			else
				dot.style.display = 'none';
		} else {
			if (apply)
				dot.style.display = 'none';
			else
				dot.style.display = 'block';
		}
	  });
	  
	 
}


let handlerRegistry = new Map();

function toggleDelayedMouseover(enable = true) {
  const elements = document.querySelectorAll(`.dot`);
  //console.log('dot elemts found ' + elements.length);
  elements.forEach(el => {
	
	//console.log('attaching to ' + el.textContent);
    let timer;

    const delayedHandler = () => {
      
      timer = setTimeout(() => masksimilarevents(el.textContent, true), 1000);
    };

    const cleardotTimer = () => {
      clearTimeout(timer);
      masksimilarevents(el.textContent, false);
    };

    if (enable) {
      if (!handlerRegistry.has(el)) {
        el.addEventListener('mouseover', delayedHandler);
        el.addEventListener('mouseout', cleardotTimer);
        handlerRegistry.set(el, { delayedHandler, cleardotTimer });
      }
    } else {
      const registered = handlerRegistry.get(el);
      if (registered) {
        el.removeEventListener('mouseover', registered.delayedHandler);
        el.removeEventListener('mouseout', registered.cleardotTimer);
        handlerRegistry.delete(el);
      }
    }
  });
}


function masksimilarevents(ticker, apply) {
  // Inject CSS if not already present
  if (!document.getElementById('highlight-dot-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-dot-style';
    style.textContent = `
      @keyframes pulseDot {
        0% { transform: scale(1); box-shadow: none; }
        50% { transform: scale(1.5); box-shadow: 0 0 10px rgba(255, 165, 0, 0.6); }
        100% { transform: scale(1); box-shadow: none; }
      }

      .highlight-dot {
        animation: pulseDot 2s ease;
      }

      .price-moves-container {
        transition: opacity 0.5s ease;
      }
    `;
    document.head.appendChild(style);
  }

  const container = document.querySelector('.price-moves-container');
  const dots = document.querySelectorAll('.evt-dot');

  const tickerfirstChar = alphabetLocation(ticker.charAt(0) || '');
  const tickersecondChar = alphabetLocation(ticker.charAt(1) || '');

  // Apply fade-in effect
  if (apply) {
    container.style.zIndex = '999';    
  } else {    
    setTimeout(() => {
      container.style.zIndex = '1';
    }, 500); // Delay lowering z-index until fade-out completes
  }

  dots.forEach(dot => {
    const firstChar = alphabetLocation(dot.getAttribute('data-ticker').charAt(0) || '');
    const secondChar = alphabetLocation(dot.getAttribute('data-ticker').charAt(1) || '');

    const isSimilar = tickerfirstChar === firstChar && tickersecondChar === secondChar;

    if (isSimilar) {
      if (apply) {
        dot.style.display = 'block';
        dot.classList.add('highlight-dot');
        setTimeout(() => {
          dot.classList.remove('highlight-dot');
        }, 1500);
      } else {
        dot.style.display = 'none';
      }
    } else {
      dot.style.display = apply ? 'none' : 'block';
    }
  });
}



let colorMode = ''; // default

function applyEventColors() {
  document.querySelectorAll('.dot').forEach(dot => {
    const firstChar = alphabetLocation(dot.textContent.charAt(0) || '');
    const secondChar = alphabetLocation(dot.textContent.charAt(1) || '');
    const color = getColorForNumber(parseInt(firstChar)*10 + parseInt(secondChar));
    if (color) dot.style.backgroundColor = color;
  });
}

function applyUniformColor() {
  document.querySelectorAll('.dot').forEach(dot => {
    dot.style.backgroundColor = dot.dataset.savedBgClr; 
  });
}

window.PriceMoves = {
  render: renderPriceMoves,
  toggle: addAccordionToggleRight
};
})();