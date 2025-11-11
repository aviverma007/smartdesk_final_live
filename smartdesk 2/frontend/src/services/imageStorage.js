// Image Storage Service - Frontend Implementation
// This handles image persistence using localStorage and IndexedDB

class ImageStorageService {
  constructor() {
    this.dbName = 'EmployeeImageDB';
    this.storeName = 'images';
    this.version = 1;
    this.db = null;
    this.initDB();
  }

  // Initialize IndexedDB for larger image storage
  async initDB() {
    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'employeeId' });
            store.createIndex('employeeId', 'employeeId', { unique: true });
          }
        };
      });
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      // Fallback to localStorage
    }
  }

  // Save image to storage
  async saveImage(employeeId, imageFile) {
    try {
      // Convert file to base64 for storage
      const base64 = await this.fileToBase64(imageFile);
      
      const imageData = {
        employeeId: employeeId,
        base64: base64,
        fileName: imageFile.name,
        fileType: imageFile.type,
        fileSize: imageFile.size,
        timestamp: new Date().toISOString(),
        url: base64 // For immediate use
      };

      // Try IndexedDB first
      if (this.db) {
        await this.saveToIndexedDB(imageData);
      } else {
        // Fallback to localStorage
        this.saveToLocalStorage(employeeId, imageData);
      }

      // Also save to localStorage for quick access
      this.saveImageUrlToLocalStorage(employeeId, base64);
      
      return base64;
    } catch (error) {
      console.error('Error saving image:', error);
      throw error;
    }
  }

  // Save to IndexedDB
  async saveToIndexedDB(imageData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(imageData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Save to localStorage (for smaller images or fallback)
  saveToLocalStorage(employeeId, imageData) {
    try {
      // Compress data if it's too large for localStorage
      const compressedData = {
        employeeId: imageData.employeeId,
        url: imageData.base64,
        timestamp: imageData.timestamp
      };
      localStorage.setItem(`employee_image_${employeeId}`, JSON.stringify(compressedData));
    } catch (error) {
      console.error('LocalStorage save failed:', error);
    }
  }

  // Save just the image URL for quick access
  saveImageUrlToLocalStorage(employeeId, imageUrl) {
    try {
      localStorage.setItem(`employee_image_url_${employeeId}`, imageUrl);
    } catch (error) {
      console.error('Error saving image URL to localStorage:', error);
    }
  }

  // Get image from storage
  async getImage(employeeId) {
    try {
      // First try IndexedDB
      if (this.db) {
        const imageData = await this.getFromIndexedDB(employeeId);
        if (imageData) {
          return imageData.url;
        }
      }
      
      // Then try localStorage URL
      const imageUrl = localStorage.getItem(`employee_image_url_${employeeId}`);
      if (imageUrl) {
        return imageUrl;
      }

      // Finally try full localStorage data
      const storedData = localStorage.getItem(`employee_image_${employeeId}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        return parsed.url;
      }

      return null;
    } catch (error) {
      console.error('Error retrieving image:', error);
      return null;
    }
  }

  // Get from IndexedDB
  async getFromIndexedDB(employeeId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(employeeId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Convert file to base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  // Get all stored images (for bulk operations)
  async getAllImages() {
    try {
      const images = {};
      
      if (this.db) {
        const allImages = await this.getAllFromIndexedDB();
        allImages.forEach(img => {
          images[img.employeeId] = img.url;
        });
      }

      // Also get from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('employee_image_url_')) {
          const employeeId = key.replace('employee_image_url_', '');
          if (!images[employeeId]) {
            images[employeeId] = localStorage.getItem(key);
          }
        }
      }

      return images;
    } catch (error) {
      console.error('Error getting all images:', error);
      return {};
    }
  }

  // Get all from IndexedDB
  async getAllFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete image
  async deleteImage(employeeId) {
    try {
      if (this.db) {
        await this.deleteFromIndexedDB(employeeId);
      }
      localStorage.removeItem(`employee_image_${employeeId}`);
      localStorage.removeItem(`employee_image_url_${employeeId}`);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  // Delete from IndexedDB
  async deleteFromIndexedDB(employeeId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(employeeId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all images
  async clearAllImages() {
    try {
      if (this.db) {
        await this.clearIndexedDB();
      }
      
      // Clear localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('employee_image_') || key.startsWith('employee_image_url_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing all images:', error);
    }
  }

  // Clear IndexedDB
  async clearIndexedDB() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Process and store image (API compatibility method)
  async processAndStore(imageData, employeeId) {
    try {
      // If imageData is already a data URL, use it directly
      if (typeof imageData === 'string' && imageData.startsWith('data:')) {
        this.saveImageUrlToLocalStorage(employeeId, imageData);
        return { profileImage: imageData };
      }

      // If imageData has imageUrl property
      if (imageData && imageData.imageUrl) {
        this.saveImageUrlToLocalStorage(employeeId, imageData.imageUrl);
        return { profileImage: imageData.imageUrl };
      }

      // If it's an object with profileImage property
      if (imageData && imageData.profileImage) {
        this.saveImageUrlToLocalStorage(employeeId, imageData.profileImage);
        return { profileImage: imageData.profileImage };
      }

      // Fallback - treat as direct image data
      this.saveImageUrlToLocalStorage(employeeId, imageData);
      return { profileImage: imageData };
    } catch (error) {
      console.error('Error processing and storing image:', error);
      throw error;
    }
  }

  // Convert file to data URL (API compatibility method)
  async fileToDataURL(file) {
    try {
      const dataURL = await this.fileToBase64(file);
      return dataURL;
    } catch (error) {
      console.error('Error converting file to data URL:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const imageStorage = new ImageStorageService();
export default imageStorage;