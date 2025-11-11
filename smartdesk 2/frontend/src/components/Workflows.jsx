import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { 
  Workflow,
  Clock,
  Settings,
  ArrowRight
} from "lucide-react";

const Workflows = () => {
  return (
    <div className="h-full flex flex-col justify-center items-center space-y-8">
      {/* Coming Soon Banner */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 bg-blue-100 rounded-full">
            <Workflow className="h-16 w-16 text-blue-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
          <p className="text-xl text-gray-600">Coming Soon</p>
        </div>
        
        <div className="max-w-md mx-auto">
          <p className="text-gray-500 leading-relaxed">
            We're building an advanced workflow management system that will help you 
            streamline your business processes and automate routine tasks.
          </p>
        </div>
      </div>

      {/* Features Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <Settings className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Process Automation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm">
              Automate repetitive tasks and create efficient workflows for your team
            </p>
          </CardContent>
        </Card>

        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <ArrowRight className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-lg">Step-by-Step Guidance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm">
              Clear instructions and checkpoints to ensure consistent execution
            </p>
          </CardContent>
        </Card>

        <Card className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Time Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm">
              Monitor workflow progress and optimize processing times
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Message */}
      <div className="bg-blue-50 rounded-lg p-6 max-w-md mx-auto text-center">
        <h3 className="font-semibold text-blue-900 mb-2">Stay Tuned!</h3>
        <p className="text-blue-700 text-sm">
          This feature is currently under development and will be available soon. 
          We're working hard to bring you the best workflow management experience.
        </p>
      </div>
    </div>
  );
};

export default Workflows;