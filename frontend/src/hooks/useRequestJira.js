import { useState } from 'react';
import toast from 'react-hot-toast';
import { scenarioRequestAPI } from '../services/api';

const DEFAULT_JIRA_LINK = { ticket_key: '', ticket_url: '', title: '', link_type: 'dependency' };

function buildJiraLinkPayload(newJiraLink) {
  return {
    ticket_key: newJiraLink.ticket_key.trim().toUpperCase(),
    ticket_url: newJiraLink.ticket_url.trim() || null,
    title: newJiraLink.title.trim() || null,
    link_type: newJiraLink.link_type
  };
}

const useRequestJira = (requestId, loadRequest) => {
  const [showAddJiraLinkModal, setShowAddJiraLinkModal] = useState(false);
  const [newJiraLink, setNewJiraLink] = useState({ ...DEFAULT_JIRA_LINK });
  const [addingJiraLink, setAddingJiraLink] = useState(false);
  const [removingJiraLinkIndex, setRemovingJiraLinkIndex] = useState(null);

  const handleAddJiraLink = async () => {
    if (!newJiraLink.ticket_key.trim()) {
      toast.error('Jira ticket key is required');
      return;
    }

    setAddingJiraLink(true);
    try {
      await scenarioRequestAPI.addJiraLink(requestId, buildJiraLinkPayload(newJiraLink));
      toast.success('Jira link added');
      setShowAddJiraLinkModal(false);
      setNewJiraLink({ ...DEFAULT_JIRA_LINK });
      loadRequest();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add Jira link');
    } finally {
      setAddingJiraLink(false);
    }
  };

  const handleRemoveJiraLink = async (index) => {
    setRemovingJiraLinkIndex(index);
    try {
      await scenarioRequestAPI.removeJiraLink(requestId, index);
      toast.success('Jira link removed');
      loadRequest();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove Jira link');
    } finally {
      setRemovingJiraLinkIndex(null);
    }
  };

  const closeJiraLinkModal = () => {
    setShowAddJiraLinkModal(false);
    setNewJiraLink({ ...DEFAULT_JIRA_LINK });
  };

  return {
    showAddJiraLinkModal,
    setShowAddJiraLinkModal,
    newJiraLink,
    setNewJiraLink,
    addingJiraLink,
    removingJiraLinkIndex,
    handleAddJiraLink,
    handleRemoveJiraLink,
    closeJiraLinkModal
  };
};

export default useRequestJira;
