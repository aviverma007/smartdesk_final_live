import React, { useState } from "react";
import { User, ChevronDown, ChevronUp, Users, Building2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const BoxNode = ({ employee, childrenMap, level = 0, expandedNodes, onToggle }) => {
  const children = childrenMap.get(employee.id) || [];
  const isExpanded = expandedNodes.has(employee.id);
  const hasChildren = children && children.length > 0;
  
  const getBoxStyle = (level) => {
    const sizes = [
      { width: 'w-80', height: 'h-24', text: 'text-base' }, // Level 0 - CEO/Top
      { width: 'w-72', height: 'h-20', text: 'text-sm' },   // Level 1 - Directors
      { width: 'w-64', height: 'h-18', text: 'text-sm' },   // Level 2 - Managers
      { width: 'w-56', height: 'h-16', text: 'text-sm' },   // Level 3 - Leads
      { width: 'w-48', height: 'h-14', text: 'text-xs' },   // Level 4+ - Contributors
    ];
    
    return {
      size: sizes[Math.min(level, sizes.length - 1)]
    };
  };

  const boxStyle = getBoxStyle(level);
  const marginLeft = level * 60;

  return (
    <div className="relative" style={{ marginLeft: `${marginLeft}px` }}>
      {/* Simple connecting lines */}
      {level > 0 && (
        <>
          {/* Horizontal line to parent */}
          <div 
            className="absolute bg-gray-400 h-0.5"
            style={{
              left: -60,
              top: `${parseInt(boxStyle.size.height.replace('h-', '')) * 4 + 8}px`,
              width: '60px'
            }}
          />
          
          {/* Vertical line from parent */}
          <div 
            className="absolute bg-gray-400 w-0.5"
            style={{
              left: -60,
              top: -30,
              height: `${parseInt(boxStyle.size.height.replace('h-', '')) * 4 + 38}px`
            }}
          />
        </>
      )}

      {/* Blue Box Container */}
      <div className="relative mb-8">
        {/* Main Blue Box */}
        <div className={`${boxStyle.size.width} ${boxStyle.size.height} relative`}>
          {/* Blue Background Box */}
          <div className="absolute inset-0 bg-gray-100 border-2 border-gray-300 rounded-lg shadow-lg">
          </div>
          
          {/* Box Content */}
          <div className="absolute inset-0 flex items-center justify-between px-4 py-2">
            {/* Employee Info Section */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Profile Image */}
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border-2 border-gray-400 flex-shrink-0">
                {employee.profileImage && employee.profileImage !== "/api/placeholder/150/150" ? (
                  <img 
                    src={employee.profileImage} 
                    alt={employee.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <User className="h-5 w-5 text-gray-600" 
                     style={{display: employee.profileImage && employee.profileImage !== "/api/placeholder/150/150" ? 'none' : 'flex'}} />
              </div>

              {/* Employee Details - Only Name and ID */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col space-y-1">
                  <h3 className={`font-bold text-gray-900 ${boxStyle.size.text} truncate`}>
                    {employee.name}
                  </h3>
                  <div className="flex items-center">
                    <Badge className="text-xs bg-gray-800 text-white border-gray-800 px-2 py-1">
                      {employee.id}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Control Section */}
            {hasChildren && (
              <div className="flex flex-col items-center space-y-2 flex-shrink-0">
                {/* Team Count Badge */}
                <Badge className="bg-gray-800 text-white border-gray-800 text-xs px-2 py-1">
                  <Users className="h-3 w-3 mr-1" />
                  <span className="font-bold">{children.length}</span>
                </Badge>
                
                {/* Expand/Collapse Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggle(employee.id)}
                  className="h-6 w-6 p-0 text-gray-700 hover:bg-gray-200 rounded border border-gray-400"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Children Section */}
        {hasChildren && isExpanded && (
          <div className="mt-6 space-y-4 relative">
            {/* Vertical connection line for children */}
            <div 
              className="absolute bg-gray-400 w-0.5"
              style={{
                left: '50%',
                top: '-15px',
                height: `${children.length * 120}px`,
                transform: 'translateX(-50%)'
              }}
            />
            
            {/* Child nodes */}
            <div className="relative space-y-4">
              {children.map((child, index) => (
                <BoxNode 
                  key={child.id}
                  employee={child} 
                  childrenMap={childrenMap}
                  level={level + 1}
                  expandedNodes={expandedNodes}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const HierarchyTree = ({ hierarchyStructure }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const { topLevel, childrenMap } = hierarchyStructure;

  const toggleNode = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Initialize all nodes as expanded for better visualization
  React.useEffect(() => {
    const allNodeIds = new Set();
    const addNodeIds = (nodes) => {
      nodes.forEach(node => {
        allNodeIds.add(node.id);
        const children = childrenMap.get(node.id) || [];
        addNodeIds(children);
      });
    };
    addNodeIds(topLevel);
    setExpandedNodes(allNodeIds);
  }, [topLevel, childrenMap]);

  if (topLevel.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 relative">
        <div className="relative z-10">
          <div className="w-40 h-20 bg-gray-100 border-2 border-gray-300 mx-auto mb-6 rounded-lg flex items-center justify-center shadow-lg">
            <User className="h-8 w-8 text-gray-600" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-600">No hierarchy structure to display</h3>
          <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
            Add reporting relationships above to see the organizational structure.
          </p>
        </div>
      </div>
    );
  }

  const buildBoxTree = (employee) => {
    return (
      <BoxNode 
        key={employee.id}
        employee={employee} 
        childrenMap={childrenMap}
        level={0}
        expandedNodes={expandedNodes}
        onToggle={toggleNode}
      />
    );
  };

  return (
    <div className="relative bg-white p-8 rounded-xl border-2 border-gray-200 overflow-x-auto">
      <div className="relative z-10 flex flex-col space-y-10 min-w-max">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-3 bg-gray-100 px-6 py-3 rounded-lg border border-gray-300 shadow-md mb-4">
            <div className="w-6 h-4 bg-gray-700 rounded"></div>
            <h4 className="text-xl font-bold text-gray-900">Organizational Structure</h4>
            <div className="w-6 h-4 bg-gray-700 rounded"></div>
          </div>
          <p className="text-gray-700 font-medium">Interactive hierarchy visualization with reporting relationships</p>
        </div>
        
        {/* Box Structure */}
        <div className="space-y-16 relative">
          {topLevel.map((employee, index) => (
            <div key={employee.id}>
              {buildBoxTree(employee)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HierarchyTree;