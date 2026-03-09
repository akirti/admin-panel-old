import { useState } from 'react';
import toast from 'react-hot-toast';
import { scenarioRequestAPI } from '../services/api';

const useRequestComments = (requestId, loadRequest) => {
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await scenarioRequestAPI.addComment(requestId, newComment);
      setNewComment('');
      loadRequest();
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  return { newComment, setNewComment, submittingComment, handleAddComment };
};

export default useRequestComments;
