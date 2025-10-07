import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, LogOut } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface Topic {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState("");
  const [customText, setCustomText] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const fetchTopics = async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .order("name");

      if (error) {
        toast({
          title: "Error loading topics",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setTopics(data || []);
      }
    };

    fetchTopics();
  }, [toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleStartQuiz = async () => {
    if (!selectedTopic && !customTopic && !customText) {
      toast({
        title: "Selection required",
        description: "Please select a topic or provide custom content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from("quiz_sessions")
        .insert({
          user_id: user?.id,
          topic_id: selectedTopic || null,
          custom_topic: customTopic || null,
          custom_text: customText || null,
          skill_level: skillLevel,
          status: "active",
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      navigate(`/quiz/${sessionData.id}`);
    } catch (error: any) {
      toast({
        title: "Error creating quiz",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold">Smart Quizzer</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Create a New Quiz</CardTitle>
            <CardDescription>
              Select a topic or provide your own content to generate questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base">Skill Level</Label>
              <RadioGroup value={skillLevel} onValueChange={setSkillLevel} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Beginner" id="beginner" />
                  <Label htmlFor="beginner">Beginner</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Intermediate" id="intermediate" />
                  <Label htmlFor="intermediate">Intermediate</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Advanced" id="advanced" />
                  <Label htmlFor="advanced">Advanced</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base">Select a Topic</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {topics.map((topic) => (
                  <Card
                    key={topic.id}
                    className={`cursor-pointer transition-colors hover:border-primary ${
                      selectedTopic === topic.id ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => {
                      setSelectedTopic(topic.id);
                      setCustomTopic("");
                      setCustomText("");
                    }}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="font-medium">{topic.name}</p>
                      <p className="text-sm text-muted-foreground">{topic.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="custom-topic">Custom Topic</Label>
              <input
                id="custom-topic"
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={customTopic}
                onChange={(e) => {
                  setCustomTopic(e.target.value);
                  if (e.target.value) setSelectedTopic("");
                }}
                placeholder="Enter a custom topic (e.g., Quantum Physics)"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="custom-text">Or Provide Your Own Text</Label>
              <Textarea
                id="custom-text"
                value={customText}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  if (e.target.value) {
                    setSelectedTopic("");
                    setCustomTopic("");
                  }
                }}
                placeholder="Paste or type a paragraph, article, or any content you want to be quizzed on..."
                className="min-h-[120px]"
              />
            </div>

            <Button
              onClick={handleStartQuiz}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Creating Quiz..." : "Start Quiz"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;