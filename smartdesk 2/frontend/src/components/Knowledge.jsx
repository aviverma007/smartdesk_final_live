import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { PlusCircle, Search, BookOpen, Tags, Trash2, Edit3, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { knowledgeAPI } from '../services/api';

const Knowledge = () => {
  const [articles, setArticles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [viewingArticle, setViewingArticle] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'announcement',
    tags: '',
    author: 'Admin'
  });
  const [loading, setLoading] = useState(true);

  const categories = [
    'all',
    'policy',
    'process', 
    'training',
    'announcement',
    'guideline',
    'other'
  ];

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const data = await knowledgeAPI.getAll();
      setArticles(data);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Failed to load knowledge articles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const articleData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      if (editingArticle) {
        await knowledgeAPI.update(editingArticle.id, articleData);
        toast.success('Article updated successfully');
      } else {
        await knowledgeAPI.create(articleData);
        toast.success('Article created successfully');
      }
      
      fetchArticles();
      resetForm();
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Failed to save article');
    }
  };

  const handleDelete = async (articleId) => {
    if (window.confirm('Are you sure you want to delete this article?')) {
      try {
        await knowledgeAPI.delete(articleId);
        toast.success('Article deleted successfully');
        fetchArticles();
      } catch (error) {
        console.error('Error deleting article:', error);
        toast.error('Failed to delete article');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'announcement',
      tags: '',
      author: 'Admin'
    });
    setShowAddForm(false);
    setEditingArticle(null);
  };

  const handleEdit = (article) => {
    setFormData({
      ...article,
      tags: Array.isArray(article.tags) ? article.tags.join(', ') : ''
    });
    setEditingArticle(article);
    setShowAddForm(true);
  };

  const handleView = (article) => {
    setViewingArticle(article);
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (article.tags && article.tags.some(tag => 
                           tag.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category) => {
    switch (category) {
      case 'policy':
        return 'bg-red-100 text-red-800';
      case 'process':
        return 'bg-blue-100 text-blue-800';
      case 'training':
        return 'bg-green-100 text-green-800';
      case 'announcement':
        return 'bg-purple-100 text-purple-800';
      case 'guideline':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading knowledge base...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
        <Button onClick={() => setShowAddForm(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Article
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search articles, content, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Add/Edit Article Form */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingArticle ? 'Edit Article' : 'Create New Article'}</CardTitle>
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
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full p-2 border rounded-md"
                  >
                    {categories.slice(1).map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Author</label>
                  <Input
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
                  <Input
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  rows={6}
                  required
                />
              </div>

              <div className="flex space-x-2">
                <Button type="submit">
                  {editingArticle ? 'Update Article' : 'Create Article'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Article View Modal */}
      {viewingArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{viewingArticle.title}</h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>By {viewingArticle.author}</span>
                    <span>{new Date(viewingArticle.created_at).toLocaleDateString()}</span>
                    <Badge className={getCategoryColor(viewingArticle.category)}>
                      {viewingArticle.category}
                    </Badge>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setViewingArticle(null)}>
                  ×
                </Button>
              </div>
              
              {viewingArticle.tags && viewingArticle.tags.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center space-x-2">
                    <Tags className="h-4 w-4 text-gray-400" />
                    <div className="flex flex-wrap gap-1">
                      {viewingArticle.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap">{viewingArticle.content}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map(article => (
          <Card key={article.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleView(article)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(article)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(article.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 line-clamp-3">{article.content}</p>
                
                <Badge className={getCategoryColor(article.category)}>
                  {article.category}
                </Badge>

                {article.tags && article.tags.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Tags className="h-3 w-3 text-gray-400" />
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {article.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{article.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>By {article.author}</span>
                  <span>{new Date(article.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No articles found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Get started by creating your first knowledge article.'}
          </p>
          {!searchTerm && selectedCategory === 'all' && (
            <div className="mt-6">
              <Button onClick={() => setShowAddForm(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add your first article
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Knowledge;