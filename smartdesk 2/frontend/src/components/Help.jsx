import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { PlusCircle, Send, MessageSquare, Trash2, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { helpAPI } from '../services/api';

const Help = () => {
  const [helpRequests, setHelpRequests] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'normal',
    author: 'User'
  });
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchHelpRequests();
  }, []);

  const fetchHelpRequests = async () => {
    try {
      const data = await helpAPI.getAll();
      setHelpRequests(data);
    } catch (error) {
      console.error('Error fetching help requests:', error);
      toast.error('Failed to load help requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await helpAPI.create(formData);
      toast.success('Help request submitted successfully');
      
      // Verify the request was saved by fetching it back
      fetchHelpRequests();
      resetForm();
    } catch (error) {
      console.error('Error creating help request:', error);
      toast.error('Failed to submit help request');
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyingTo || !replyMessage.trim()) return;

    try {
      await helpAPI.addReply(replyingTo.id, {
        message: replyMessage,
        author: 'Admin'
      });
      
      toast.success('Reply added successfully');
      setReplyMessage('');
      setReplyingTo(null);
      fetchHelpRequests();
    } catch (error) {
      console.error('Error adding reply:', error);
      toast.error('Failed to add reply');
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      await helpAPI.update(requestId, { status: newStatus });
      toast.success('Status updated successfully');
      fetchHelpRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (messageId) => {
    if (window.confirm('Are you sure you want to delete this help request?')) {
      try {
        await helpAPI.delete(messageId);
        toast.success('Help request deleted successfully');
        fetchHelpRequests();
      } catch (error) {
        console.error('Error deleting help request:', error);
        toast.error('Failed to delete help request');
      }
    }
  };

  const handleBulkResolve = async () => {
    const resolvedMessages = helpRequests.filter(req => req.status === 'resolved');
    if (resolvedMessages.length === 0) {
      toast.info('No resolved messages to delete');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${resolvedMessages.length} resolved message(s)?`)) {
      try {
        const deletePromises = resolvedMessages.map(msg => helpAPI.delete(msg.id));
        await Promise.all(deletePromises);
        toast.success(`${resolvedMessages.length} resolved message(s) deleted successfully`);
        fetchHelpRequests();
      } catch (error) {
        console.error('Error deleting resolved messages:', error);
        toast.error('Failed to delete resolved messages');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      priority: 'normal',
      author: 'User'
    });
    setShowAddForm(false);
  };

  const filteredRequests = helpRequests.filter(request => {
    if (filter === 'all') return true;
    return request.status === filter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading help requests...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleBulkResolve}>
            Clean Resolved
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-6">
        {[
          { key: 'all', label: 'All Requests' },
          { key: 'open', label: 'Open' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'resolved', label: 'Resolved' }
        ].map(tab => (
          <Button
            key={tab.key}
            variant={filter === tab.key ? "default" : "outline"}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Add Help Request Form */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Submit New Help Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Your Name</label>
                  <Input
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <Textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  rows={4}
                  required
                />
              </div>

              <div className="flex space-x-2">
                <Button type="submit">
                  Submit Request
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reply Form */}
      {replyingTo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Reply to: {replyingTo.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReply} className="space-y-4">
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Enter your reply..."
                rows={3}
                required
              />
              <div className="flex space-x-2">
                <Button type="submit">
                  <Send className="mr-2 h-4 w-4" />
                  Send Reply
                </Button>
                <Button type="button" variant="outline" onClick={() => setReplyingTo(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Help Requests */}
      <div className="space-y-6">
        {filteredRequests.map(request => (
          <Card key={request.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{request.title}</CardTitle>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getStatusColor(request.status)}>
                      {request.status.replace('_', ' ')}
                    </Badge>
                    <Badge className={getPriorityColor(request.priority)}>
                      {request.priority}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      by {request.author} • {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReplyingTo(request)}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(request.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">{request.message}</p>

                {/* Status Change Buttons */}
                <div className="flex space-x-2">
                  {request.status !== 'open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(request.id, 'open')}
                    >
                      Reopen
                    </Button>
                  )}
                  {request.status !== 'in_progress' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(request.id, 'in_progress')}
                    >
                      In Progress
                    </Button>
                  )}
                  {request.status !== 'resolved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(request.id, 'resolved')}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Resolve
                    </Button>
                  )}
                </div>

                {/* Replies */}
                {request.replies && request.replies.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="font-semibold text-sm text-gray-600">Replies:</h4>
                    {request.replies.map(reply => (
                      <div key={reply.id} className="bg-gray-50 p-3 rounded-md">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">{reply.author}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(reply.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No help requests found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'all' 
              ? 'Get started by submitting your first help request.' 
              : `No requests with status "${filter}".`}
          </p>
          {filter === 'all' && (
            <div className="mt-6">
              <Button onClick={() => setShowAddForm(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Submit your first request
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Help;