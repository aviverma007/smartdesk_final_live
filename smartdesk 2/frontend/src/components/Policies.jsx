import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChevronDown, ChevronRight, FileText, ExternalLink, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { policyAPI } from '../services/api';

const Policies = () => {
  const { isAdmin } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    hr: true,
    admin: false,
    it: false
  });
  const [loading, setLoading] = useState(true);

  // All policies organized by categories - mapped to actual files
  const policyData = {
    "HR POLICY": [
      { 
        title: "Working Hours & Attendance Policy", 
        link: "/company policies/Working Hours & Attendance Policy.pdf", 
        description: "Attendance requirements and working hours guidelines"
      },
      { 
        title: "Sexual Harassment At Work Redressal Policy", 
        link: "/company policies/_12_39_b356500c83384d2d_Sexual Harassment At Work Redressal Policy_26-Apr-22.pdf", 
        description: "Workplace harassment prevention and redressal procedures"
      },
      { 
        title: "Dress Code Policy", 
        link: "/company policies/_13_55_00673d13502c42da_Dress code policy.pdf", 
        description: "Professional dress code guidelines and standards"
      },
      { 
        title: "Employee Referral Policy", 
        link: "/company policies/_14_19_2fe9bd4b1c514d00_Employee referral policy.pdf", 
        description: "Employee referral program guidelines and procedures"
      },
      { 
        title: "Leave Policy (Revised)", 
        link: "/company policies/_14_33_50e319284d7e4fe4_Leave Policy (Revised).pdf", 
        description: "Comprehensive leave policy including all types of leaves"
      },
      { 
        title: "Local Conveyance Policy", 
        link: "/company policies/_15_9_02985794b8584650_Local Conveyance policy.pdf", 
        description: "Local travel and conveyance reimbursement guidelines"
      },
      { 
        title: "Whistle Blower Policy", 
        link: "/company policies/_16_4_3edd02c8f36f429f_Whistle Blower Policy.pdf", 
        description: "Whistleblower protection and reporting procedures"
      },
      { 
        title: "Tour Travel Policy", 
        link: "/company policies/_23_44_6eca6e909cee4aa7_Tour Travel Policy.pdf", 
        description: "Business travel guidelines and expense policies"
      },
      { 
        title: "Revised Attendance Policy", 
        link: "/company policies/_36_12_f19af68b04f849ee_Revised Attendance Policy w.e.f 21st May 25.pdf", 
        description: "Updated attendance policy effective from May 21, 2025"
      },
      { 
        title: "Night Shift Meal & Conveyance Allowance", 
        link: "/company policies/_38_0_62d66a9aaaf645cc_Meal and Conveyance for Employees Working at Night on Sites.pdf", 
        description: "Meal and conveyance allowance for employees working night shifts on sites"
      },
      { 
        title: "Flexible Work Schedule Policy", 
        link: "/company policies/Microsoft Word - Flexible Work Schedule.pdf", 
        description: "Guidelines for flexible working arrangements and remote work policies"
      }
    ],
    "ADMIN POLICY": [
      { 
        title: "Office Administration Guidelines", 
        link: "/company policies/Office Administration Guidelines.pdf", 
        description: "General office administration and management procedures"
      },
      { 
        title: "Asset Management Policy", 
        link: "/company policies/Asset Management Policy.pdf", 
        description: "Company asset allocation, maintenance, and return procedures"
      },
      { 
        title: "Visitor Management Policy", 
        link: "/company policies/Visitor Management Policy.pdf", 
        description: "Guidelines for visitor access and management procedures"
      },
      { 
        title: "Document Management Policy", 
        link: "/company policies/Document Management Policy.pdf", 
        description: "Document creation, storage, and archival procedures"
      },
      { 
        title: "Facility Management Guidelines", 
        link: "/company policies/Facility Management Guidelines.pdf", 
        description: "Office facility usage and maintenance guidelines"
      }
    ],
    "IT POLICY": [
      { 
        title: "IT Security Policy", 
        link: "/company policies/IT Security Policy.pdf", 
        description: "Information security guidelines and best practices"
      },
      { 
        title: "Data Protection Policy", 
        link: "/company policies/Data Protection Policy.pdf", 
        description: "Data privacy and protection compliance procedures"
      },
      { 
        title: "Email and Internet Usage Policy", 
        link: "/company policies/Email and Internet Usage Policy.pdf", 
        description: "Guidelines for appropriate email and internet usage"
      },
      { 
        title: "Software License Management", 
        link: "/company policies/Software License Management.pdf", 
        description: "Software installation and license compliance procedures"
      },
      { 
        title: "IT Equipment Policy", 
        link: "/company policies/IT Equipment Policy.pdf", 
        description: "IT equipment allocation, usage, and maintenance guidelines"
      },
      { 
        title: "Backup and Recovery Policy", 
        link: "/company policies/Backup and Recovery Policy.pdf", 
        description: "Data backup and disaster recovery procedures"
      }
    ]
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Get policies to display based on user role
  const getPoliciesToDisplay = () => {
    if (isAdmin()) {
      return policyData; // Admin sees all policies (HR, ADMIN, IT)
    } else {
      return policyData; // User also sees all policies (HR, ADMIN, IT)
    }
  };

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      // We're using hardcoded policy data for now, but keeping the API structure
      // const data = await policyAPI.getAll();
      // setPolicies(data);
    } catch (error) {
      console.error('Error fetching policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handlePolicyClick = (link) => {
    try {
      // Encode the URL properly to handle spaces and special characters
      const encodedLink = encodeURI(link);
      console.log('Opening policy:', encodedLink);
      window.open(encodedLink, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening policy:', error);
      // Fallback: try direct link
      window.open(link, '_blank');
    }
  };

  const getSectionKey = (title) => {
    return title.toLowerCase().replace(' policy', '').replace(' ', '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading policies...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Company Policies</h1>
        
        {/* Professional banner image */}
        <div className="relative h-48 bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg overflow-hidden mb-6">
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <FileText className="mx-auto h-16 w-16 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Corporate Policy Center</h2>
              <p className="text-lg opacity-90">Your comprehensive guide to company policies and procedures</p>
            </div>
          </div>
        </div>
      </div>

      {/* Policy sections - HR, ADMIN, and IT policies with categorization */}
      <div className="space-y-6">
        {Object.entries(getPoliciesToDisplay()).map(([sectionTitle, sectionPolicies]) => {
          const sectionKey = getSectionKey(sectionTitle);
          const isExpanded = expandedSections[sectionKey];
          
          return (
            <Card key={sectionTitle} className="w-full">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleSection(sectionKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                    <FileText className="h-6 w-6 text-blue-600" />
                    <CardTitle className="text-xl text-gray-900">{sectionTitle}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {sectionPolicies.length} {sectionPolicies.length === 1 ? 'Policy' : 'Policies'}
                  </Badge>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {sectionPolicies.map((policy, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <div>
                              <h4 className="font-medium text-gray-900">{policy.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{policy.description}</p>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePolicyClick(policy.link)}
                          className="ml-4"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View PDF
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Policies;