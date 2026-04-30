"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  X,
  Save,
  Loader2,
  GraduationCap,
  Target,
  Sparkles,
  Settings,
} from "lucide-react";

interface SubjectLevel {
  subject: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  confidence: number;
}

interface LearningStyle {
  preferredFormat: "visual" | "text" | "examples" | "interactive";
  pace: "slow" | "moderate" | "fast";
  detailLevel: "brief" | "moderate" | "detailed";
}

interface Goal {
  goal: string;
  deadline?: string;
  status: "active" | "completed" | "paused";
}

interface SkillProfile {
  subjectLevels: SubjectLevel[];
  learningStyle: LearningStyle;
  goals: Goal[];
  strengths: string[];
  preferences: {
    language?: string;
    difficultyPreference?: "easy" | "moderate" | "challenging";
    sessionDuration?: number;
  };
}

const DEFAULT_PROFILE: SkillProfile = {
  subjectLevels: [],
  learningStyle: { preferredFormat: "text", pace: "moderate", detailLevel: "moderate" },
  goals: [],
  strengths: [],
  preferences: {},
};

const LEVEL_OPTIONS = [
  { value: "beginner", label: "初级" },
  { value: "intermediate", label: "中级" },
  { value: "advanced", label: "高级" },
  { value: "expert", label: "专家" },
];

const FORMAT_OPTIONS = [
  { value: "visual", label: "图文并茂" },
  { value: "text", label: "文本阅读" },
  { value: "examples", label: "案例学习" },
  { value: "interactive", label: "互动练习" },
];

const PACE_OPTIONS = [
  { value: "slow", label: "循序渐进" },
  { value: "moderate", label: "适中" },
  { value: "fast", label: "快速" },
];

const DETAIL_OPTIONS = [
  { value: "brief", label: "简洁" },
  { value: "moderate", label: "中等" },
  { value: "detailed", label: "详细" },
];

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "偏简单" },
  { value: "moderate", label: "适中" },
  { value: "challenging", label: "有挑战性" },
];

export default function SkillsPage() {
  const [profile, setProfile] = useState<SkillProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newStrength, setNewStrength] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      if (data.profile) setProfile({ ...DEFAULT_PROFILE, ...data.profile });
    } catch (error) {
      console.error("Error fetching skill profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
    } catch (error) {
      console.error("Error saving skill profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const addSubject = () => {
    if (!newSubject.trim()) return;
    setProfile((prev) => ({
      ...prev,
      subjectLevels: [
        ...prev.subjectLevels,
        { subject: newSubject.trim(), level: "beginner", confidence: 0.5 },
      ],
    }));
    setNewSubject("");
  };

  const removeSubject = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      subjectLevels: prev.subjectLevels.filter((_, i) => i !== index),
    }));
  };

  const updateSubjectLevel = (index: number, level: SubjectLevel["level"]) => {
    setProfile((prev) => ({
      ...prev,
      subjectLevels: prev.subjectLevels.map((s, i) =>
        i === index ? { ...s, level } : s
      ),
    }));
  };

  const updateSubjectConfidence = (index: number, confidence: number) => {
    setProfile((prev) => ({
      ...prev,
      subjectLevels: prev.subjectLevels.map((s, i) =>
        i === index ? { ...s, confidence } : s
      ),
    }));
  };

  const addStrength = () => {
    if (!newStrength.trim()) return;
    setProfile((prev) => ({
      ...prev,
      strengths: [...prev.strengths, newStrength.trim()],
    }));
    setNewStrength("");
  };

  const removeStrength = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      strengths: prev.strengths.filter((_, i) => i !== index),
    }));
  };

  const addGoal = () => {
    if (!newGoal.trim()) return;
    setProfile((prev) => ({
      ...prev,
      goals: [
        ...prev.goals,
        {
          goal: newGoal.trim(),
          deadline: newGoalDeadline || undefined,
          status: "active" as const,
        },
      ],
    }));
    setNewGoal("");
    setNewGoalDeadline("");
  };

  const removeGoal = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index),
    }));
  };

  const toggleGoalStatus = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      goals: prev.goals.map((g, i) =>
        i === index
          ? { ...g, status: g.status === "completed" ? "active" : "completed" }
          : g
      ),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">技能画像</h1>
                <p className="text-sm text-muted-foreground">设置你的学习偏好，AI 将据此个性化回答</p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {/* 学科水平 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-500" />
              <CardTitle>学科水平</CardTitle>
            </div>
            <CardDescription>添加你正在学习的学科及掌握程度</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.subjectLevels.map((subject, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="font-medium min-w-[80px]">{subject.subject}</span>
                <Select
                  value={subject.level}
                  onValueChange={(v) => updateSubjectLevel(index, v as SubjectLevel["level"])}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">置信度</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={subject.confidence}
                    onChange={(e) => updateSubjectConfidence(index, parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8">{subject.confidence.toFixed(1)}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeSubject(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="输入学科名称"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubject()}
              />
              <Button variant="outline" onClick={addSubject}>
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 学习风格 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <CardTitle>学习风格</CardTitle>
            </div>
            <CardDescription>AI 将根据你的偏好调整回答方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>偏好形式</Label>
                <Select
                  value={profile.learningStyle.preferredFormat}
                  onValueChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      learningStyle: { ...prev.learningStyle, preferredFormat: v as LearningStyle["preferredFormat"] },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>学习节奏</Label>
                <Select
                  value={profile.learningStyle.pace}
                  onValueChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      learningStyle: { ...prev.learningStyle, pace: v as LearningStyle["pace"] },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>详细程度</Label>
                <Select
                  value={profile.learningStyle.detailLevel}
                  onValueChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      learningStyle: { ...prev.learningStyle, detailLevel: v as LearningStyle["detailLevel"] },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DETAIL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 学习目标 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              <CardTitle>学习目标</CardTitle>
            </div>
            <CardDescription>设定你的学习目标，AI 会帮你追踪进度</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.goals.map((goal, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <button
                  onClick={() => toggleGoalStatus(index)}
                  className={`h-5 w-5 rounded-full border-2 flex-shrink-0 ${
                    goal.status === "completed"
                      ? "bg-green-500 border-green-500"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                />
                <span className={`flex-1 ${goal.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                  {goal.goal}
                </span>
                {goal.deadline && (
                  <Badge variant="outline" className="text-xs">
                    截止 {goal.deadline}
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => removeGoal(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="输入学习目标"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                className="flex-1"
              />
              <Input
                type="date"
                value={newGoalDeadline}
                onChange={(e) => setNewGoalDeadline(e.target.value)}
                className="w-[160px]"
              />
              <Button variant="outline" onClick={addGoal}>
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 强势领域 + 偏好设置 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-500" />
                <CardTitle className="text-lg">强势领域</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {profile.strengths.map((strength, index) => (
                  <Badge key={index} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
                    {strength}
                    <button
                      onClick={() => removeStrength(index)}
                      className="ml-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="添加强势领域"
                  value={newStrength}
                  onChange={(e) => setNewStrength(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStrength()}
                />
                <Button variant="outline" size="sm" onClick={addStrength}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-slate-500" />
                <CardTitle className="text-lg">偏好设置</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>难度偏好</Label>
                <Select
                  value={profile.preferences.difficultyPreference || "moderate"}
                  onValueChange={(v) =>
                    setProfile((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, difficultyPreference: v as "easy" | "moderate" | "challenging" },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>每次学习时长（分钟）</Label>
                <Input
                  type="number"
                  min={5}
                  max={240}
                  placeholder="30"
                  value={profile.preferences.sessionDuration || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, sessionDuration: parseInt(e.target.value) || undefined },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
