// src/SMEAAnecdotal.jsx
// SMEA — Anecdotal Records & Incident Monitoring Hub

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import useAcademicCalendar from "./hooks/useAcademicCalendar";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle, 
  ShieldAlert, 
  Trash2, 
  Edit3, 
  X, 
  Sparkles,
  UserCheck
} from "lucide-react";

const CATEGORIES = [
  { id: "behavioral", label: "Behavioral / Disciplinary", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
  { id: "academic", label: "Academic Concern", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
  { id: "commendation", label: "Positive Recognition / Commendation", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
  { id: "guidance", label: "Guidance / Counseling Referral", color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800" },
  { id: "attendance", label: "Chronic Attendance / Truancy", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800" },
];

export default function SMEAAnecdotal({ user }) {
  const { schoolYears } = useAcademicCalendar();
  const [selectedSY, setSelectedSY] = useState("2026-2027");
  const [records, setRecords] = useState([]);
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    lrn: "",
    learnerName: "",
    gradeLevel: "Grade 7",
    section: "",
    category: "behavioral",
    date: new Date().toISOString().split("T")[0],
    incidentDetails: "",
    actionTaken: "",
    status: "open", // open, resolved, referred
    observerName: user?.displayName || user?.email || "Teacher",
  });

  // Fetch Learners & Anecdotal Records
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [learnersSnap, recordsSnap] = await Promise.all([
          getDocs(collection(db, "learners")),
          getDocs(collection(db, "anecdotal_records")),
        ]);

        if (cancelled) return;

        const fetchedLearners = learnersSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),